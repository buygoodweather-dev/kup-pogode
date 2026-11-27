import type { Env, Order } from "./env";
import { esc, formatDate, condLabel } from "../public/cert.js";
import { t, HTML_LANG } from "./i18n";
import { orderLang } from "./pages";

export type SendResult = "sent" | "failed" | "skipped";

export async function sendEmail(env: Env, msg: { to: string; subject: string; html: string; text: string; idempotencyKey?: string }): Promise<SendResult> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email skipped: no RESEND_API_KEY] to=${msg.to} subject=${msg.subject}`);
    return "skipped";
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", ...(msg.idempotencyKey ? { "Idempotency-Key": msg.idempotencyKey } : {}) },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text, reply_to: env.SUPPORT_EMAIL }),
    });
    if (!res.ok) console.error("resend error", res.status, await res.text());
    return res.ok ? "sent" : "failed";
  } catch (e) {
    console.error("resend exception", e);
    return "failed";
  }
}

const conds = (o: Order) => (JSON.parse(o.weather_preferences) as string[]).map((c) => condLabel(c, orderLang(o))).join(", ");
const when = (o: Order) => formatDate(o.weather_date, orderLang(o));

function layout(o: Order, inner: string): string {
  const lang = orderLang(o);
  return `<!doctype html><html lang="${HTML_LANG[lang]}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F6F8FB;font-family:Helvetica,Arial,sans-serif;color:#1B2130">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FB"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFCF4;border:1px solid #E5D8BA;border-radius:14px">
<tr><td style="padding:28px 28px 8px;font-weight:800;letter-spacing:3px;font-size:13px">☀️ KUP POGODĘ</td></tr>
${inner}
<tr><td style="padding:20px 28px 28px;font-size:12px;color:#8A7A55;line-height:1.5">${esc(t(lang, "mDisclaimer"))}</td></tr>
</table></td></tr></table></body></html>`;
}

function details(o: Order): string {
  const lang = orderLang(o);
  const row = (k: string, v: string) => `<tr><td style="padding:6px 0;color:#8A7A55;font-size:13px">${esc(k)}</td><td style="padding:6px 0;text-align:right;font-size:15px;font-weight:bold">${esc(v)}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E5D8BA;border-bottom:1px solid #E5D8BA;margin:16px 0">
${row(t(lang, "mPlace"), o.location)}${row(t(lang, "mDate"), when(o))}${row(t(lang, "mWeather"), conds(o))}${row(t(lang, "mTemp"), o.temperature)}${row(t(lang, "mOrder"), o.order_id)}</table>`;
}

const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#F2A61F;color:#1B2130;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:999px;font-size:15px">${esc(label)}</a>`;

export function buyerEmail(env: Env, o: Order) {
  const lang = orderLang(o);
  const site = env.SITE_URL.replace(/\/$/, "");
  const url = `${site}/c/${o.cert_token}`;
  const forWho = o.for_me ? "" : t(lang, "mForWho", { name: esc(o.recipient_name) });
  const html = layout(o, `<tr><td style="padding:8px 28px">
<h1 style="font-size:26px;line-height:1.15;margin:8px 0 12px">${esc(t(lang, "mBuyerH1"))}</h1>
<p style="font-size:15px;line-height:1.55;margin:0">${t(lang, "mBuyerHello", { buyer: esc(o.purchaser_name), forWho })}</p>
${details(o)}
<p style="font-size:15px;line-height:1.55;margin:0 0 18px">${esc(t(lang, "mBuyerReady"))}</p>
${button(url, t(lang, "mSee"))}
<p style="font-size:12px;color:#5A6474;margin:22px 0 0;line-height:1.5">${esc(t(lang, "mWaiver"))} <a href="${esc(site)}/regulamin" style="color:#1B2130">${esc(t(lang, "mTerms"))}</a>.</p>
<p style="font-size:13px;color:#5A6474;margin:14px 0 0">${esc(t(lang, "mComplain"))} <a href="${esc(site)}/reklamacja?o=${o.order_id}" style="color:#1B2130">${esc(t(lang, "mComplainLink"))}</a>.</p>
</td></tr>`);
  const text = `${t(lang, "mBuyerH1")}\n\n${t(lang, "mPlace")}: ${o.location}\n${t(lang, "mDate")}: ${when(o)}\n${t(lang, "mWeather")}: ${conds(o)}\n${t(lang, "mTemp")}: ${o.temperature}\n${t(lang, "mOrder")}: ${o.order_id}\n\n${t(lang, "mCertLine")}: ${url}\n\n${t(lang, "mWaiver")}\n`;
  return { to: o.purchaser_email, subject: t(lang, "mBuyerSubject"), html, text };
}

export function recipientEmail(env: Env, o: Order) {
  const lang = orderLang(o);
  const url = `${env.SITE_URL.replace(/\/$/, "")}/c/${o.cert_token}`;
  const html = layout(o, `<tr><td style="padding:8px 28px">
<h1 style="font-size:26px;line-height:1.15;margin:8px 0 12px">${t(lang, "mRcptH1", { name: esc(o.recipient_name) })}</h1>
<p style="font-size:15px;line-height:1.55;margin:0">${t(lang, "mRcptText", { buyer: esc(o.purchaser_name) })}</p>
${details(o)}
${o.personal_message ? `<p style="font-family:Georgia,serif;font-style:italic;font-size:18px;line-height:1.4;margin:0 0 18px">„${esc(o.personal_message)}”</p>` : ""}
${button(url, t(lang, "mRcptSee"))}
</td></tr>`);
  const text = `${t(lang, "mRcptH1", { name: o.recipient_name })}\n\n${o.location}, ${when(o)}\n${o.personal_message ? `„${o.personal_message}”\n` : ""}\n${t(lang, "mCertLine")}: ${url}\n`;
  return { to: o.recipient_email!, subject: t(lang, "mRcptSubject", { buyer: o.purchaser_name }), html, text };
}

export function refundEmail(o: Order) {
  const lang = orderLang(o);
  const html = layout(o, `<tr><td style="padding:8px 28px">
<h1 style="font-size:24px;line-height:1.15;margin:8px 0 12px">${esc(t(lang, "mRefH1"))}</h1>
<p style="font-size:15px;line-height:1.55;margin:0">${esc(t(lang, "mRefText", { order: o.order_id }))}</p>
</td></tr>`);
  return { to: o.purchaser_email, subject: t(lang, "mRefSubject"), html, text: t(lang, "mRefText", { order: o.order_id }) };
}
