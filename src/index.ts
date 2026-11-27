import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Env, Order } from "./env";
import { CheckoutSchema, EventSchema, GreetingSchema, RefundSchema } from "./validation";
import { createCheckoutSession, createRefund, verifyStripeSignature } from "./stripe";
import { firstTimeEvent, getOrder, getOrderByToken, logEvent } from "./db";
import { markPaid, deliverCertificate } from "./fulfil";
import { certData, certificatePage, messagePage, notFoundPage, orderLang, refundPage, successPage } from "./pages";
import { CLIENT, HTML_LANG, LANDING, LANDING_META, LANGS, isLang, pickLang, t, type Lang } from "./i18n";
import { AI_PER_DAY, AI_PER_VISITOR_PER_HOUR, makeGreeting } from "./greeting";
import { decideRefund } from "./refunds";
import { refundEmail, sendEmail } from "./email";
import { certificatePdf } from "./pdf";
import { FONTS } from "./fonts";
import { admin } from "./admin";
import { addDays, deviceFromUA, formatPLN, newOrderId, newToken, nowIso, pickVariant, todayWarsaw } from "./util";

const PRODUCT = { slug: "dobra-pogoda" };
const app = new Hono<{ Bindings: Env }>();

// Until a real domain is set in SITE_URL, links (Stripe return URLs, e-mails) use the address the site was opened on.
app.use("*", async (c, next) => {
  const host = new URL(c.req.url).host;
  if ((!c.env.SITE_URL || c.env.SITE_URL.includes("localhost")) && !host.startsWith("localhost")) c.env = { ...c.env, SITE_URL: new URL(c.req.url).origin };
  await next();
});

// ---------- offer (price + guarantee variant), kept per visitor in a first-party cookie ----------
function offer(c: { env: Env; req: { raw: Request } }, cookie?: string) {
  const [p, g] = (cookie || "").split("|");
  const price = pickVariant(c.env.PRICE_VARIANTS, p);
  const guarantee = pickVariant(c.env.GUARANTEE_VARIANTS, g);
  return { price, guarantee, amount: Number(price), display: formatPLN(Number(price)) };
}

/** Visitor's language: ?lang=, then the remembered choice, then the browser language. */
function visitorLang(c: any): Lang {
  return pickLang(c.req.query("lang"), getCookie(c, "kp_lang"), c.req.header("Accept-Language"));
}
const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

/**
 * Landing page: static Polish HTML with the visitor's price, guarantee variant and language filled in
 * on the server (no flicker, no per-visit translation cost).
 */
async function landing(c: any) {
  const o = offer(c, getCookie(c, "kp_v"));
  const secure = c.req.url.startsWith("https") ? "; Secure" : "";
  // set on the returned Response directly: Hono's setCookie does not reach a Response built by hand
  const cookies = [`kp_v=${encodeURIComponent(`${o.price}|${o.guarantee}`)}; Path=/; Max-Age=${60 * 60 * 24 * 60}; SameSite=Lax${secure}`];
  const lang = visitorLang(c);
  if (isLang(c.req.query("lang"))) cookies.push(`kp_lang=${lang}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`);
  const dict = LANDING[lang];
  const meta = LANDING_META[lang];
  const fill = (s: string) => s.replace(/\{price\}/g, o.display);
  const site = c.env.SITE_URL.replace(/\/$/, "");
  const asset = await c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url)));
  let rw = new HTMLRewriter()
    .on("[data-price]", { element: (el) => { el.setInnerContent(o.display); } })
    .on("html", { element: (el) => { el.setAttribute("lang", HTML_LANG[lang]); } })
    .on("body", { element: (el) => { el.setAttribute("data-g", o.guarantee); } })
    .on("title", { element: (el) => { el.setInnerContent(meta.title); } })
    .on('meta[name="description"]', { element: (el) => { el.setAttribute("content", meta.desc); } })
    .on('meta[property="og:title"]', { element: (el) => { el.setAttribute("content", meta.title); } })
    .on('meta[property="og:description"]', { element: (el) => { el.setAttribute("content", meta.ogDesc); } })
    .on(".langs a", { element: (el) => { if (el.getAttribute("hreflang") === lang) el.setAttribute("aria-current", "true"); else el.removeAttribute("aria-current"); } })
    .on("head", { element: (el) => {
      el.append(LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site}/?lang=${l}">`).join("") + `<link rel="alternate" hreflang="x-default" href="${site}/">`, { html: true });
      el.append(`<script>window.KP_OFFER=${json({ price: o.price, guarantee: o.guarantee, display: o.display })};window.KP_LANG=${json(lang)};window.KP_T=${json(CLIENT[lang])}</script>`, { html: true });
    } });
  if (dict) {
    rw = rw
      .on("[data-i18n]", { element: (el) => { const v = dict[el.getAttribute("data-i18n") ?? ""]; if (v !== undefined) el.setInnerContent(fill(v), { html: true }); } })
      .on("[data-i18n-attr]", { element: (el) => {
        for (const pair of (el.getAttribute("data-i18n-attr") ?? "").split(";")) {
          const [attr, key] = pair.split(":");
          const v = dict[key];
          if (attr && v !== undefined) el.setAttribute(attr, fill(v));
        }
      } });
  }
  const res = rw.transform(asset);
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "private, no-cache");
  out.headers.set("Vary", "Accept-Language, Cookie");
  out.headers.set("Content-Language", HTML_LANG[lang]);
  out.headers.delete("ETag");
  for (const ck of cookies) out.headers.append("Set-Cookie", ck);
  return out;
}
app.get("/", landing);
app.get("/index.html", landing);

// ---------- checkout ----------
app.post("/api/checkout", async (c) => {
  const body = await c.req.json().catch(() => null);
  const lang = isLang(body?.lang) ? body.lang : visitorLang(c);
  if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: t(lang, "payOff") }, 503);
  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "")))];
    return c.json({ error: t(lang, "checkForm"), fields }, 400);
  }
  const v = parsed.data;
  const o = offer(c, getCookie(c, "kp_v")); // the price comes from server config, never from the request body
  const device = deviceFromUA(c.req.header("User-Agent") ?? null);
  let orderId = "";
  for (let i = 0; i < 5 && !orderId; i++) {
    const candidate = newOrderId();
    const r = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO orders (order_id, cert_token, product, status, created_at, purchaser_name, purchaser_email, for_me, recipient_name, recipient_email,
        location, weather_date, temperature, weather_preferences, personal_message, price_variant, guarantee_variant, amount, currency, source, campaign, device, lang, greeting_style)
       VALUES (?,?,?,'pending',?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pln',?,?,?,?,?)`,
    ).bind(candidate, newToken(), PRODUCT.slug, nowIso(), v.buyer, v.email, v.forMe ? 1 : 0, v.recipient, v.recipientEmail || null,
      v.place, v.date, v.temp, JSON.stringify(v.conditions), v.message || null, o.price, o.guarantee, o.amount, v.source ?? null, v.campaign ?? null, device, v.lang, v.style ?? null).run();
    if (r.meta.changes) orderId = candidate;
  }
  if (!orderId) return c.json({ error: t(lang, "tryLater") }, 500);
  const order = (await getOrder(c.env, orderId))!;
  try {
    const session = await createCheckoutSession(c.env, order, t(v.lang, "productName"));
    await c.env.DB.prepare("UPDATE orders SET checkout_session_id=? WHERE order_id=?").bind(session.id, orderId).run();
    await logEvent(c.env, { name: "checkout_started", sid: v.sid, orderId, source: v.source, campaign: v.campaign, device, priceVariant: o.price, guaranteeVariant: o.guarantee });
    return c.json({ url: session.url });
  } catch (e) {
    console.error(e);
    return c.json({ error: t(lang, "payFail") }, 502);
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
  if (!o || !s || o.checkout_session_id !== s) return c.html(notFoundPage(visitorLang(c)), 404);
  return c.html(successPage(c.env, o, s));
});

app.post("/api/resend", async (c) => {
  const f = await c.req.parseBody();
  const o = await getOrder(c.env, String(f.o ?? ""));
  if (!o || o.checkout_session_id !== String(f.s ?? "") || o.status !== "paid") return c.html(notFoundPage(visitorLang(c)), 404);
  const lang = orderLang(o);
  if (o.email_resends >= 3) return c.html(messagePage(t(lang, "limitTitle"), t(lang, "limitText"), lang), 429);
  await deliverCertificate(c.env, o, true);
  return c.html(messagePage(t(lang, "resentTitle"), t(lang, "resentText", { email: o.purchaser_email }), lang));
});

// ---------- certificate ----------
app.get("/c/:token", async (c) => {
  const o = await getOrderByToken(c.env, c.req.param("token"));
  if (!o || o.status !== "paid") return c.html(notFoundPage(visitorLang(c)), 404);
  return c.html(certificatePage(c.env, o));
});
app.get("/c/:token/pdf", async (c) => {
  const o = await getOrderByToken(c.env, c.req.param("token"));
  if (!o || o.status !== "paid") return c.html(notFoundPage(visitorLang(c)), 404);
  const pdf = await certificatePdf(certData(o), FONTS);
  await logEvent(c.env, { name: "certificate_downloaded", orderId: o.order_id });
  return new Response(pdf as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${t(orderLang(o), "pdfName")}-${o.order_id}.pdf"`, "Cache-Control": "private, max-age=3600" } });
});

// ---------- Gwarancja Pogody ----------
app.get("/reklamacja", (c) => c.html(refundPage(visitorLang(c), c.req.query("o") ?? "")));
app.post("/api/refund", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = RefundSchema.safeParse(body);
  if (!parsed.success) return c.json({ message: t(isLang(body?.lang) ? body.lang : visitorLang(c), "refBad") }, 400);
  const { orderId, email, reason, lang } = parsed.data;
  const o = await getOrder(c.env, orderId);
  // same answer for "no such order" and "wrong e-mail", so nobody can probe order numbers
  if (!o || o.purchaser_email !== email) return c.json({ message: t(lang, "refNotFound") }, 404);
  const prior = await c.env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE purchaser_email=? AND refund_status IN ('processing','completed') AND refund_requested_at >= ?")
    .bind(email, new Date(Date.now() - 90 * 864e5).toISOString()).first<{ n: number }>();
  const decision = decideRefund(o, todayWarsaw(), prior?.n ?? 0, c.env.AUTO_REFUNDS === "true" && !!c.env.STRIPE_SECRET_KEY, lang);
  if (decision.kind === "reject") return c.json({ message: decision.message }, 422);
  const claimed = await c.env.DB.prepare("UPDATE orders SET refund_status=?, refund_reason=?, refund_requested_at=? WHERE order_id=? AND refund_status='none'")
    .bind(decision.kind === "auto" ? "processing" : "review", reason, nowIso(), o.order_id).run();
  if (!claimed.meta.changes) return c.json({ message: t(lang, "refDup") }, 409);
  await logEvent(c.env, { name: "refund_requested", orderId: o.order_id });
  if (decision.kind === "auto") {
    try {
      const r = await createRefund(c.env, o);
      await c.env.DB.prepare("UPDATE orders SET refund_id=? WHERE order_id=?").bind(r.id, o.order_id).run();
      await logEvent(c.env, { name: "refund_approved", orderId: o.order_id });
      await sendEmail(c.env, { ...refundEmail(o), idempotencyKey: `refund-mail-${o.order_id}` });
      return c.json({ message: t(lang, "refAuto") });
    } catch (e) {
      console.error(e);
      await c.env.DB.prepare("UPDATE orders SET refund_status='review' WHERE order_id=?").bind(o.order_id).run();
    }
  }
  return c.json({ message: t(lang, "refReview") });
});

// ---------- greeting suggestions (Workers AI free tier, ready-made texts as fallback) ----------
async function ipKey(c: any): Promise<string> {
  const ip = c.req.header("CF-Connecting-IP") ?? "local";
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("kp-greeting|" + ip));
  return "ip:" + [...new Uint8Array(h).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
app.post("/api/greeting", async (c) => {
  const parsed = GreetingSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad request" }, 400);
  const g = parsed.data;
  const key = await ipKey(c);
  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const [mine, all] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) n FROM events WHERE name='greeting_ai' AND sid=? AND ts >= ?").bind(key, hourAgo).first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) n FROM events WHERE name='greeting_ai' AND ts >= ?").bind(dayAgo).first<{ n: number }>(),
  ]);
  const allowAi = (mine?.n ?? 0) < AI_PER_VISITOR_PER_HOUR && (all?.n ?? 0) < AI_PER_DAY;
  const out = await makeGreeting(c.env, { style: g.style, lang: g.lang as Lang, recipient: g.recipient, place: g.place, current: g.current }, allowAi);
  await logEvent(c.env, { name: out.source === "ai" ? "greeting_ai" : "greeting_template", sid: key, path: g.style });
  return c.json(out, 200, { "Cache-Control": "no-store" });
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
app.notFound((c) => c.html(notFoundPage(visitorLang(c)), 404));

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
