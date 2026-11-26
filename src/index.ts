import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { Env, Order } from "./env";
import { CheckoutSchema, EventSchema, RefundSchema } from "./validation";
import { createCheckoutSession, createRefund, verifyStripeSignature } from "./stripe";
import { firstTimeEvent, getOrder, getOrderByToken, logEvent } from "./db";
import { markPaid, deliverCertificate } from "./fulfil";
import { certData, certificatePage, messagePage, notFoundPage, refundPage, successPage } from "./pages";
import { decideRefund } from "./refunds";
import { refundEmail, sendEmail } from "./email";
import { certificatePdf } from "./pdf";
import { FONTS } from "./fonts";
import { admin } from "./admin";
import { addDays, deviceFromUA, formatPLN, newOrderId, newToken, nowIso, pickVariant, todayWarsaw } from "./util";

const PRODUCT = { slug: "dobra-pogoda", name: "KUP DOBRĄ POGODĘ — certyfikat" };
const app = new Hono<{ Bindings: Env }>();

// ---------- offer (price + guarantee variant), kept per visitor in a first-party cookie ----------
function offer(c: { env: Env; req: { raw: Request } }, cookie?: string) {
  const [p, g] = (cookie || "").split("|");
  const price = pickVariant(c.env.PRICE_VARIANTS, p);
  const guarantee = pickVariant(c.env.GUARANTEE_VARIANTS, g);
  return { price, guarantee, amount: Number(price), display: formatPLN(Number(price)) };
}

/** Landing page: static HTML with the visitor's price and guarantee variant filled in on the server (no flicker). */
async function landing(c: any) {
  const o = offer(c, getCookie(c, "kp_v"));
  setCookie(c, "kp_v", `${o.price}|${o.guarantee}`, { path: "/", maxAge: 60 * 60 * 24 * 60, sameSite: "Lax", secure: c.req.url.startsWith("https") });
  const asset = await c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url)));
  const res = new HTMLRewriter()
    .on("[data-price]", { element: (el) => { el.setInnerContent(o.display); } })
    .on("body", { element: (el) => { el.setAttribute("data-g", o.guarantee); } })
    .on("head", { element: (el) => { el.append(`<script>window.KP_OFFER=${JSON.stringify({ price: o.price, guarantee: o.guarantee, display: o.display })}</script>`, { html: true }); } })
    .transform(asset);
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "private, no-cache");
  return out;
}
app.get("/", landing);
app.get("/index.html", landing);

// ---------- checkout ----------
app.post("/api/checkout", async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: "Płatności nie są jeszcze włączone. Wróć do nas wkrótce." }, 503);
  const body = await c.req.json().catch(() => null);
  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "")))];
    return c.json({ error: "Sprawdź formularz.", fields }, 400);
  }
  const v = parsed.data;
  const o = offer(c, getCookie(c, "kp_v")); // the price comes from server config, never from the request body
  const device = deviceFromUA(c.req.header("User-Agent") ?? null);
  let orderId = "";
  for (let i = 0; i < 5 && !orderId; i++) {
    const candidate = newOrderId();
    const r = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO orders (order_id, cert_token, product, status, created_at, purchaser_name, purchaser_email, for_me, recipient_name, recipient_email,
        location, weather_date, temperature, weather_preferences, personal_message, price_variant, guarantee_variant, amount, currency, source, campaign, device)
       VALUES (?,?,?,'pending',?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pln',?,?,?)`,
    ).bind(candidate, newToken(), PRODUCT.slug, nowIso(), v.buyer, v.email, v.forMe ? 1 : 0, v.recipient, v.recipientEmail || null,
      v.place, v.date, v.temp, JSON.stringify(v.conditions), v.message || null, o.price, o.guarantee, o.amount, v.source ?? null, v.campaign ?? null, device).run();
    if (r.meta.changes) orderId = candidate;
  }
  if (!orderId) return c.json({ error: "Spróbuj ponownie za chwilę." }, 500);
  const order = (await getOrder(c.env, orderId))!;
  try {
    const session = await createCheckoutSession(c.env, order, PRODUCT.name);
    await c.env.DB.prepare("UPDATE orders SET checkout_session_id=? WHERE order_id=?").bind(session.id, orderId).run();
    await logEvent(c.env, { name: "checkout_started", sid: v.sid, orderId, source: v.source, campaign: v.campaign, device, priceVariant: o.price, guaranteeVariant: o.guarantee });
    return c.json({ url: session.url });
  } catch (e) {
    console.error(e);
    return c.json({ error: "Nie udało się otworzyć płatności. Spróbuj ponownie za chwilę." }, 502);
  }
});

// ---------- Stripe webhook: the only place an order becomes paid ----------
app.post("/api/stripe/webhook", async (c) => {
  const payload = await c.req.text();
  if (!(await verifyStripeSignature(payload, c.req.header("Stripe-Signature") ?? null, c.env.STRIPE_WEBHOOK_SECRET ?? ""))) return c.text("bad signature", 400);
  const event = JSON.parse(payload) as { id: string; type: string; data: { object: any } };
  if (!(await firstTimeEvent(c.env, event.id, event.type))) return c.json({ received: true, duplicate: true });
  const obj = event.data.object;
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const orderId = obj.metadata?.order_id ?? obj.client_reference_id;
        if (obj.payment_status === "paid" && orderId) await markPaid(c.env, orderId, obj.payment_intent ?? null, obj.amount_total ?? null, obj.currency ?? null);
        break;
      }
      case "checkout.session.async_payment_failed":
        await c.env.DB.prepare("UPDATE orders SET status='failed' WHERE order_id=? AND status='pending'").bind(obj.metadata?.order_id ?? "").run();
        break;
      case "checkout.session.expired":
        await c.env.DB.prepare("UPDATE orders SET status='expired' WHERE order_id=? AND status='pending'").bind(obj.metadata?.order_id ?? "").run();
        break;
      case "charge.refunded": {
        const orderId = obj.metadata?.order_id;
        const r = await c.env.DB.prepare("UPDATE orders SET refund_status='completed', refund_completed_at=? WHERE (order_id=? OR payment_id=?) AND refund_status != 'completed'")
          .bind(nowIso(), orderId ?? "", obj.payment_intent ?? "").run();
        if (r.meta.changes) await logEvent(c.env, { name: "refund_completed", orderId });
        break;
      }
    }
  } catch (e) {
    // let Stripe retry: forget the event id so the retry is processed
    await c.env.DB.prepare("DELETE FROM webhook_events WHERE event_id=?").bind(event.id).run();
    console.error("webhook error", e);
    return c.text("error", 500);
  }
  return c.json({ received: true });
});

// ---------- after payment ----------
app.get("/sukces", async (c) => {
  const o = await getOrder(c.env, c.req.query("o") ?? "");
  const s = c.req.query("s") ?? "";
  if (!o || !s || o.checkout_session_id !== s) return c.html(notFoundPage(), 404);
  return c.html(successPage(c.env, o, s));
});

app.post("/api/resend", async (c) => {
  const f = await c.req.parseBody();
  const o = await getOrder(c.env, String(f.o ?? ""));
  if (!o || o.checkout_session_id !== String(f.s ?? "") || o.status !== "paid") return c.html(notFoundPage(), 404);
  if (o.email_resends >= 3) return c.html(messagePage("Limit wysyłek", "Wysłaliśmy już ten certyfikat kilka razy. Sprawdź folder spam albo napisz do nas."), 429);
  await deliverCertificate(c.env, o, true);
  return c.html(messagePage("Wysłane ✓", `Certyfikat poszedł ponownie na ${o.purchaser_email}.`));
});

// ---------- certificate ----------
app.get("/c/:token", async (c) => {
  const o = await getOrderByToken(c.env, c.req.param("token"));
  if (!o || o.status !== "paid") return c.html(notFoundPage(), 404);
  return c.html(certificatePage(c.env, o));
});
app.get("/c/:token/pdf", async (c) => {
  const o = await getOrderByToken(c.env, c.req.param("token"));
  if (!o || o.status !== "paid") return c.html(notFoundPage(), 404);
  const pdf = await certificatePdf(certData(o), FONTS);
  await logEvent(c.env, { name: "certificate_downloaded", orderId: o.order_id });
  return new Response(pdf as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="certyfikat-pogody-${o.order_id}.pdf"`, "Cache-Control": "private, max-age=3600" } });
});

// ---------- Gwarancja Pogody ----------
app.get("/reklamacja", (c) => c.html(refundPage(c.req.query("o") ?? "")));
app.post("/api/refund", async (c) => {
  const parsed = RefundSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ message: "Sprawdź numer zamówienia (KPG-XXXXXX), e-mail i opis." }, 400);
  const { orderId, email, reason } = parsed.data;
  const o = await getOrder(c.env, orderId);
  // same answer for "no such order" and "wrong e-mail", so nobody can probe order numbers
  if (!o || o.purchaser_email !== email) return c.json({ message: "Nie znaleźliśmy zamówienia o tym numerze i e-mailu." }, 404);
  const prior = await c.env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE purchaser_email=? AND refund_status IN ('processing','completed') AND refund_requested_at >= ?")
    .bind(email, new Date(Date.now() - 90 * 864e5).toISOString()).first<{ n: number }>();
  const decision = decideRefund(o, todayWarsaw(), prior?.n ?? 0, c.env.AUTO_REFUNDS === "true" && !!c.env.STRIPE_SECRET_KEY);
  if (decision.kind === "reject") return c.json({ message: decision.message }, 422);
  const claimed = await c.env.DB.prepare("UPDATE orders SET refund_status=?, refund_reason=?, refund_requested_at=? WHERE order_id=? AND refund_status='none'")
    .bind(decision.kind === "auto" ? "processing" : "review", reason, nowIso(), o.order_id).run();
  if (!claimed.meta.changes) return c.json({ message: "Reklamacja tego zamówienia została już zgłoszona." }, 409);
  await logEvent(c.env, { name: "refund_requested", orderId: o.order_id });
  if (decision.kind === "auto") {
    try {
      const r = await createRefund(c.env, o);
      await c.env.DB.prepare("UPDATE orders SET refund_id=? WHERE order_id=?").bind(r.id, o.order_id).run();
      await logEvent(c.env, { name: "refund_approved", orderId: o.order_id });
      await sendEmail(c.env, { ...refundEmail(o), idempotencyKey: `refund-mail-${o.order_id}` });
      return c.json({ message: "Przyjęliśmy reklamację. Pogoda nie dotrzymała umowy, więc zwracamy pieniądze. Zwykle trafiają na konto w ciągu 5–10 dni roboczych." });
    } catch (e) {
      console.error(e);
      await c.env.DB.prepare("UPDATE orders SET refund_status='review' WHERE order_id=?").bind(o.order_id).run();
    }
  }
  return c.json({ message: "Przyjęliśmy reklamację. Sprawdzimy Twoje zamówienie i wrócimy do Ciebie zgodnie z zasadami określonymi w Regulaminie." });
});

// ---------- analytics ----------
app.post("/api/event", async (c) => {
  const parsed = EventSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.body(null, 204);
  const e = parsed.data;
  const [p, g] = (getCookie(c, "kp_v") || "").split("|");
  await logEvent(c.env, { name: e.name, sid: e.sid, orderId: e.orderId, path: e.path, source: e.source, campaign: e.campaign, device: deviceFromUA(c.req.header("User-Agent") ?? null), priceVariant: p || null, guaranteeVariant: g || null });
  return c.body(null, 204);
});

app.route("/admin", admin);
app.notFound((c) => c.html(notFoundPage(), 404));

export default {
  fetch: app.fetch,
  // daily: forget unpaid checkouts after 30 days (RODO: keep only what is needed)
  async scheduled(_c: ScheduledController, env: Env) {
    const cutoff = addDays(todayWarsaw(), -30) + "T00:00:00Z";
    await env.DB.prepare("DELETE FROM orders WHERE status IN ('pending','expired','failed') AND created_at < ?").bind(cutoff).run();
    await env.DB.prepare("DELETE FROM webhook_events WHERE received_at < ?").bind(cutoff).run();
  },
} satisfies ExportedHandler<Env>;

export type { Order };
