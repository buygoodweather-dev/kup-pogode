import type { Env, Order } from "./env";
import { esc, formatDatePL } from "../public/cert.js";

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

const conds = (o: Order) => (JSON.parse(o.weather_preferences) as string[]).join(", ");

function layout(inner: string): string {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F6F8FB;font-family:Helvetica,Arial,sans-serif;color:#1B2130">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FB"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFCF4;border:1px solid #E5D8BA;border-radius:14px">
<tr><td style="padding:28px 28px 8px;font-weight:800;letter-spacing:3px;font-size:13px">☀️ KUP POGODĘ</td></tr>
${inner}
<tr><td style="padding:20px 28px 28px;font-size:12px;color:#8A7A55;line-height:1.5">Zamówienie pogody ma charakter symboliczny i rozrywkowy. Nie jest prognozą pogody ani gwarancją rzeczywistych warunków atmosferycznych.</td></tr>
</table></td></tr></table></body></html>`;
}

function details(o: Order): string {
  const row = (k: string, v: string) => `<tr><td style="padding:6px 0;color:#8A7A55;font-size:13px">${k}</td><td style="padding:6px 0;text-align:right;font-size:15px;font-weight:bold">${esc(v)}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E5D8BA;border-bottom:1px solid #E5D8BA;margin:16px 0">
${row("📍 Miejsce", o.location)}${row("📅 Data", formatDatePL(o.weather_date))}${row("☀️ Pogoda", conds(o))}${row("🌡️ Temperatura", o.temperature)}${row("Nr zamówienia", o.order_id)}</table>`;
}

const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#F2A61F;color:#1B2130;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:999px;font-size:15px">${label}</a>`;

export function buyerEmail(env: Env, o: Order) {
  const url = `${env.SITE_URL.replace(/\/$/, "")}/c/${o.cert_token}`;
  const forWho = o.for_me ? "" : ` dla: <b>${esc(o.recipient_name)}</b>`;
  const html = layout(`<tr><td style="padding:8px 28px">
<h1 style="font-size:26px;line-height:1.15;margin:8px 0 12px">Twoja dobra pogoda została zamówiona!</h1>
<p style="font-size:15px;line-height:1.55;margin:0">Cześć ${esc(o.purchaser_name)}! Pogoda${forWho} została właśnie zamówiona.</p>
${details(o)}
<p style="font-size:15px;line-height:1.55;margin:0 0 18px">Twój certyfikat jest gotowy. Możesz go zachować albo podarować komuś wyjątkowemu.</p>
${button(url, "ZOBACZ CERTYFIKAT")}
<p style="font-size:12px;color:#5A6474;margin:22px 0 0;line-height:1.5">Potwierdzenie: na Twoje wyraźne żądanie certyfikat (treść cyfrowa) został dostarczony przed upływem terminu do odstąpienia od umowy, a Ty przyjąłeś(-ęłaś) do wiadomości utratę prawa odstąpienia. Gwarancja Pogody obowiązuje niezależnie. <a href="${esc(env.SITE_URL)}/regulamin" style="color:#1B2130">Regulamin</a>.</p>
<p style="font-size:13px;color:#5A6474;margin:14px 0 0">Kupiłeś słońce, a przyszła ulewa? <a href="${esc(env.SITE_URL)}/reklamacja?o=${o.order_id}" style="color:#1B2130">Zgłoś reklamację pogody</a>.</p>
</td></tr>`);
  const text = `Twoja dobra pogoda została zamówiona!\n\nMiejsce: ${o.location}\nData: ${formatDatePL(o.weather_date)}\nPogoda: ${conds(o)}\nTemperatura: ${o.temperature}\nNr zamówienia: ${o.order_id}\n\nCertyfikat: ${url}\n\nPotwierdzenie: na Twoje wyraźne żądanie certyfikat został dostarczony przed upływem terminu do odstąpienia od umowy; przyjąłeś(-ęłaś) do wiadomości utratę prawa odstąpienia. Gwarancja Pogody obowiązuje niezależnie.\n`;
  return { to: o.purchaser_email, subject: "☀️ Twoja dobra pogoda została zamówiona!", html, text };
}

export function recipientEmail(env: Env, o: Order) {
  const url = `${env.SITE_URL.replace(/\/$/, "")}/c/${o.cert_token}`;
  const html = layout(`<tr><td style="padding:8px 28px">
<h1 style="font-size:26px;line-height:1.15;margin:8px 0 12px">${esc(o.recipient_name)}, ktoś kupił Ci dobrą pogodę ☀️</h1>
<p style="font-size:15px;line-height:1.55;margin:0"><b>${esc(o.purchaser_name)}</b> zamówił(a) dla Ciebie pogodę. Oficjalnie. Przynajmniej na papierze.</p>
${details(o)}
${o.personal_message ? `<p style="font-family:Georgia,serif;font-style:italic;font-size:18px;line-height:1.4;margin:0 0 18px">„${esc(o.personal_message)}”</p>` : ""}
${button(url, "ZOBACZ SWÓJ CERTYFIKAT")}
</td></tr>`);
  const text = `${o.recipient_name}, ${o.purchaser_name} kupił(a) Ci dobrą pogodę!\n\n${o.location}, ${formatDatePL(o.weather_date)}\n${o.personal_message ? `„${o.personal_message}”\n` : ""}\nCertyfikat: ${url}\n`;
  return { to: o.recipient_email!, subject: `☀️ ${o.purchaser_name} kupił(a) Ci dobrą pogodę`, html, text };
}

export function refundEmail(o: Order) {
  const html = layout(`<tr><td style="padding:8px 28px">
<h1 style="font-size:24px;line-height:1.15;margin:8px 0 12px">Reklamacja uznana. Pieniądze wracają.</h1>
<p style="font-size:15px;line-height:1.55;margin:0">Pogoda nie dotrzymała umowy, więc my dotrzymujemy swojej. Zwrot za zamówienie ${o.order_id} jest w drodze. Zwykle trafia na konto w ciągu 5–10 dni roboczych.</p>
</td></tr>`);
  return { to: o.purchaser_email, subject: "Reklamacja pogody uznana ☔", html, text: `Reklamacja uznana. Zwrot za zamówienie ${o.order_id} jest w drodze (zwykle 5–10 dni roboczych).` };
}
