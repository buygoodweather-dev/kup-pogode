import { Hono } from "hono";
import type { Env, Order } from "./env";
import { esc, formatDatePL } from "../public/cert.js";
import { page } from "./pages";
import { formatPLN, nowIso } from "./util";
import { getOrder, logEvent } from "./db";
import { createRefund } from "./stripe";
import { deliverCertificate } from "./fulfil";
import { refundEmail, sendEmail } from "./email";

// ---------- Cloudflare Access JWT check (defence in depth on top of the Access policy) ----------
let certCache: { at: number; keys: JsonWebKey[] } | null = null;
const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

export async function accessEmail(env: Env, req: Request): Promise<string | null> {
  const jwt = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const [h, p, s] = jwt.split(".");
  if (!h || !p || !s) return null;
  const header = JSON.parse(new TextDecoder().decode(b64url(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64url(p)));
  if (!certCache || Date.now() - certCache.at > 3600_000) {
    const r = await fetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
    certCache = { at: Date.now(), keys: ((await r.json()) as { keys: JsonWebKey[] }).keys };
  }
  const jwk = certCache.keys.find((k) => (k as JsonWebKey & { kid?: string }).kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!ok || !aud.includes(env.ACCESS_AUD) || payload.exp * 1000 < Date.now()) return null;
  const email = String(payload.email || "").toLowerCase();
  const allowed = env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(email) ? email : null;
}

export const admin = new Hono<{ Bindings: Env; Variables: { adminEmail: string } }>();

admin.use("*", async (c, next) => {
  const email = await accessEmail(c.env, c.req.raw);
  if (!email) return c.text("Brak dostępu. Panel jest chroniony przez Cloudflare Access.", 403);
  if (c.req.method === "POST") {
    // block cross-site form posts
    const origin = c.req.header("Origin");
    if (origin && new URL(origin).host !== new URL(c.req.url).host) return c.text("Zły origin", 403);
  }
  c.set("adminEmail", email);
  await next();
});

const pill = (s: string) => `<span class="pill ${esc(s)}">${esc(s)}</span>`;

admin.get("/", async (c) => {
  const db = c.env.DB;
  const q = (c.req.query("q") || "").trim();
  const days = Math.min(365, Math.max(1, Number(c.req.query("dni") || 30)));
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const count = async (name: string) => (await db.prepare("SELECT COUNT(DISTINCT COALESCE(sid, id)) n FROM events WHERE name = ? AND ts >= ?").bind(name, since).first<{ n: number }>())?.n ?? 0;
  const [visitors, started, checkout] = await Promise.all([count("page_view"), count("form_started"), count("checkout_started")]);
  const paid = await db.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM orders WHERE status='paid' AND paid_at >= ?").bind(since).first<{ n: number; s: number }>();
  const refunds = await db.prepare("SELECT COUNT(*) n FROM orders WHERE refund_status='completed' AND refund_completed_at >= ?").bind(since).first<{ n: number }>();
  const review = await db.prepare("SELECT COUNT(*) n FROM orders WHERE refund_status='review'").first<{ n: number }>();
  const bySource = await db.prepare("SELECT COALESCE(source,'(bezpośrednio)') src, COUNT(*) n, SUM(amount) s FROM orders WHERE status='paid' AND paid_at >= ? GROUP BY src ORDER BY n DESC LIMIT 10").bind(since).all<{ src: string; n: number; s: number }>();
  const byVariant = await db.prepare("SELECT price_variant pv, guarantee_variant gv, COUNT(*) n FROM orders WHERE status='paid' AND paid_at >= ? GROUP BY pv, gv").bind(since).all<{ pv: string; gv: string; n: number }>();
  const visitsByVariant = await db.prepare("SELECT price_variant pv, guarantee_variant gv, COUNT(DISTINCT sid) n FROM events WHERE name='page_view' AND ts >= ? GROUP BY pv, gv").bind(since).all<{ pv: string; gv: string; n: number }>();
  const orders = q
    ? await db.prepare("SELECT * FROM orders WHERE order_id LIKE ? OR purchaser_email LIKE ? OR recipient_name LIKE ? ORDER BY id DESC LIMIT 200").bind(`%${q}%`, `%${q.toLowerCase()}%`, `%${q}%`).all<Order>()
    : await db.prepare("SELECT * FROM orders WHERE status != 'pending' OR created_at >= ? ORDER BY id DESC LIMIT 200").bind(new Date(Date.now() - 2 * 864e5).toISOString()).all<Order>();

  const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1).replace(".", ",") + "%" : "—");
  const tiles = [
    ["Odwiedzający", visitors], ["Zaczęli formularz", started], ["Przeszli do płatności", checkout], ["Zakupy", paid?.n ?? 0],
    ["Konwersja", pct(paid?.n ?? 0, visitors)], ["Przychód", formatPLN(paid?.s ?? 0)], ["Zwroty", `${refunds?.n ?? 0} (${pct(refunds?.n ?? 0, paid?.n ?? 0)})`], ["Do decyzji", review?.n ?? 0],
  ].map(([k, v]) => `<div class="tile"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("");

  const variantRows = (visitsByVariant.results || []).map((v) => {
    const sold = (byVariant.results || []).find((b) => b.pv === v.pv && b.gv === v.gv)?.n ?? 0;
    return `<tr><td>${esc(formatPLN(Number(v.pv) || 0))}</td><td>${esc(v.gv)}</td><td>${v.n}</td><td>${sold}</td><td>${pct(sold, v.n)}</td></tr>`;
  }).join("");

  const rows = (orders.results || []).map((o) => `<tr>
<td><b>${esc(o.order_id)}</b><br><small>${esc(o.created_at.slice(0, 16).replace("T", " "))}</small></td>
<td>${pill(o.status)}</td>
<td>${esc(o.purchaser_name)}<br><small>${esc(o.purchaser_email)}</small></td>
<td>${esc(o.recipient_name)}${o.recipient_email ? `<br><small>${esc(o.recipient_email)}</small>` : ""}</td>
<td>${esc(o.location)}<br><small>${esc(formatDatePL(o.weather_date))} · ${esc(o.temperature)}</small></td>
<td>${esc(formatPLN(o.amount))}<br><small>${esc(o.source || "")}</small></td>
<td>${pill(o.email_status)}${o.recipient_email ? " " + pill(o.recipient_email_status) : ""}</td>
<td>${o.refund_status === "none" ? "" : pill(o.refund_status)}${o.refund_reason ? `<br><small>${esc(o.refund_reason)}</small>` : ""}</td>
<td style="white-space:nowrap">${o.status === "paid" ? `<a href="/c/${esc(o.cert_token)}" target="_blank">certyfikat</a> · <a href="/c/${esc(o.cert_token)}/pdf">PDF</a>${o.payment_id ? ` · <a href="https://dashboard.stripe.com/payments/${esc(o.payment_id)}" target="_blank">Stripe</a>` : ""}
<form method="post" action="/admin/orders/${esc(o.order_id)}/resend"><button class="btn small ghost">Wyślij ponownie</button></form>
${["none", "review"].includes(o.refund_status) ? `<form method="post" action="/admin/orders/${esc(o.order_id)}/refund"><button class="btn small">Zwróć pieniądze</button></form>` : ""}
${o.refund_status === "review" ? `<form method="post" action="/admin/orders/${esc(o.order_id)}/deny"><button class="btn small ghost">Odrzuć</button></form>` : ""}` : ""}</td></tr>`).join("");

  return c.html(page({
    title: "Panel · KUP POGODĘ",
    body: `<h1 style="font-size:34px">Panel</h1><p class="sub">Zalogowano: ${esc(c.get("adminEmail"))} · ostatnie ${days} dni · <a href="?dni=7">7</a> · <a href="?dni=30">30</a> · <a href="?dni=90">90</a></p>
<div class="tiles">${tiles}</div>
<h2 style="font-size:22px">Testy A/B</h2><div class="scroll"><table class="tbl"><tr><th>Cena</th><th>Gwarancja</th><th>Odwiedzający</th><th>Zakupy</th><th>Konwersja</th></tr>${variantRows || `<tr><td colspan="5">Brak danych</td></tr>`}</table></div>
<h2 style="font-size:22px;margin-top:28px">Źródła zakupów</h2><div class="scroll"><table class="tbl"><tr><th>Źródło</th><th>Zakupy</th><th>Przychód</th></tr>${(bySource.results || []).map((s) => `<tr><td>${esc(s.src)}</td><td>${s.n}</td><td>${esc(formatPLN(s.s))}</td></tr>`).join("") || `<tr><td colspan="3">Brak danych</td></tr>`}</table></div>
<h2 style="font-size:22px;margin-top:28px">Zamówienia</h2>
<form method="get" style="display:flex;gap:8px;margin:12px 0;max-width:480px"><input name="q" value="${esc(q)}" placeholder="Numer, e-mail albo imię"><button class="btn small">Szukaj</button></form>
<div class="scroll"><table class="tbl"><tr><th>Zamówienie</th><th>Status</th><th>Kupujący</th><th>Odbiorca</th><th>Pogoda</th><th>Kwota</th><th>E-mail</th><th>Zwrot</th><th></th></tr>${rows || `<tr><td colspan="9">Brak zamówień</td></tr>`}</table></div>`,
  }));
});

admin.post("/orders/:id/resend", async (c) => {
  const o = await getOrder(c.env, c.req.param("id"));
  if (o?.status === "paid") await deliverCertificate(c.env, o, true);
  return c.redirect("/admin?q=" + encodeURIComponent(c.req.param("id")));
});

admin.post("/orders/:id/refund", async (c) => {
  const o = await getOrder(c.env, c.req.param("id"));
  if (!o || o.status !== "paid" || !["none", "review"].includes(o.refund_status)) return c.redirect("/admin");
  const r = await createRefund(c.env, o);
  await c.env.DB.prepare("UPDATE orders SET refund_status='processing', refund_id=?, refund_requested_at=COALESCE(refund_requested_at, ?) WHERE order_id=?").bind(r.id, nowIso(), o.order_id).run();
  await logEvent(c.env, { name: "refund_approved", orderId: o.order_id });
  await sendEmail(c.env, { ...refundEmail(o), idempotencyKey: `refund-mail-${o.order_id}` });
  return c.redirect("/admin?q=" + encodeURIComponent(o.order_id));
});

admin.post("/orders/:id/deny", async (c) => {
  await c.env.DB.prepare("UPDATE orders SET refund_status='denied' WHERE order_id=? AND refund_status='review'").bind(c.req.param("id")).run();
  return c.redirect("/admin?q=" + encodeURIComponent(c.req.param("id")));
});
