import type { Env, Order } from "./env";
import { esc, formatDatePL, renderCertificate } from "../public/cert.js";

const FONTS = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Manrope:wght@400;600;700;800&family=Cormorant+Garamond:ital,wght@0,600;0,700;1,500&family=Pinyon+Script&display=swap";

export function page(opts: { title: string; body: string; head?: string; noindex?: boolean }): string {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(opts.title)}</title>${opts.noindex !== false ? '<meta name="robots" content="noindex">' : ""}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/pages.css">${opts.head ?? ""}</head>
<body><header class="site"><div class="wrap"><a class="logo" href="/"><i aria-hidden="true"></i>KUP POGODĘ</a></div></header>
<main><div class="wrap">${opts.body}</div></main>
<footer><div class="wrap">Zamówienie pogody ma charakter symboliczny i rozrywkowy. Nie jest prognozą pogody. · <a href="/regulamin">Regulamin</a> · <a href="/prywatnosc">Polityka prywatności</a></div></footer>
</body></html>`;
}

export function certData(o: Order) {
  return {
    recipient: o.recipient_name,
    place: o.location,
    dateLabel: formatDatePL(o.weather_date),
    temp: o.temperature,
    conditions: JSON.parse(o.weather_preferences) as string[],
    message: o.personal_message ?? "",
    buyer: o.purchaser_name,
    certNo: o.order_id,
  };
}

const trackScript = (name: string, orderId: string) =>
  `<script>(function(){function t(n){try{navigator.sendBeacon("/api/event",new Blob([JSON.stringify({name:n,orderId:${JSON.stringify(orderId)},path:location.pathname})],{type:"application/json"}))}catch(e){}}window.kpTrack=t;t(${JSON.stringify(name)});})();</script>`;

const shareScript = `<script>
document.getElementById("share")?.addEventListener("click", async function () {
  var url = this.dataset.url, title = "Kupiłem Ci dobrą pogodę ☀️";
  window.kpTrack && kpTrack("certificate_shared");
  if (navigator.share) { try { await navigator.share({ title: title, text: title, url: url }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(url); this.textContent = "Link skopiowany ✓"; } catch (e) { prompt("Skopiuj link:", url); }
});
document.getElementById("pdf")?.addEventListener("click", function () { window.kpTrack && kpTrack("certificate_downloaded"); });
</script>`;

/** Success page after Stripe redirects back. Waits for the webhook when needed. */
export function successPage(env: Env, o: Order, sessionId: string): string {
  if (o.status !== "paid") {
    return page({
      title: "Czekamy na potwierdzenie płatności",
      head: `<meta http-equiv="refresh" content="3">`,
      body: `<div style="display:grid;gap:18px;justify-items:start;max-width:560px"><div class="spinner" aria-hidden="true"></div>
<h1>Sprawdzamy płatność…</h1><p class="sub">Operator płatności jeszcze nie potwierdził zamówienia ${esc(o.order_id)}. Zwykle trwa to kilka sekund. Ta strona odświeży się sama.</p>
<p class="note">Jeśli płaciłeś BLIK-iem, potwierdź płatność w aplikacji banku. Certyfikat wyślemy też na ${esc(o.purchaser_email)}.</p></div>`,
    });
  }
  const url = `${env.SITE_URL.replace(/\/$/, "")}/c/${o.cert_token}`;
  const d = certData(o);
  return page({
    title: "Pogoda została zamówiona! ☀️",
    body: `<div class="grid"><div>
<h1>Pogoda została zamówiona! ☀️</h1><p class="sub">Oficjalnie. Przynajmniej na papierze.</p>
<dl class="kv"><dt>Numer zamówienia</dt><dd>${esc(o.order_id)}</dd><dt>Dla</dt><dd>${esc(o.recipient_name)}</dd><dt>Miejsce</dt><dd>${esc(o.location)}</dd><dt>Data</dt><dd>${esc(d.dateLabel)}</dd><dt>Pogoda</dt><dd>${esc(o.temperature)} · ${esc(d.conditions.join(", "))}</dd></dl>
<div class="acts"><button class="btn sun" id="share" data-url="${esc(url)}">WYŚLIJ CERTYFIKAT</button><a class="btn ghost" id="pdf" href="/c/${esc(o.cert_token)}/pdf">POBIERZ PDF</a><a class="btn ghost" href="/c/${esc(o.cert_token)}">POKAŻ CERTYFIKAT</a></div>
<form method="post" action="/api/resend" style="margin-top:12px"><input type="hidden" name="o" value="${esc(o.order_id)}"><input type="hidden" name="s" value="${esc(sessionId)}"><button class="btn small ghost" type="submit">WYŚLIJ PONOWNIE E-MAIL</button></form>
<p class="note">Certyfikat wysłaliśmy na ${esc(o.purchaser_email)}${o.recipient_email ? ` i ${esc(o.recipient_email)}` : ""}.</p>
</div><div class="cert">${renderCertificate(d)}</div></div>${trackScript("certificate_viewed", o.order_id)}${shareScript}`,
  });
}

/** Public certificate page (the link people share). */
export function certificatePage(env: Env, o: Order): string {
  const url = `${env.SITE_URL.replace(/\/$/, "")}/c/${o.cert_token}`;
  const d = certData(o);
  const ogTitle = `${o.recipient_name}, ktoś kupił Ci dobrą pogodę ☀️`;
  return page({
    title: `Certyfikat zakupu pogody · ${o.recipient_name}`,
    head: `<meta property="og:title" content="${esc(ogTitle)}"><meta property="og:description" content="${esc(`${o.location}, ${d.dateLabel}. Oficjalny certyfikat KUP POGODĘ.`)}"><meta property="og:image" content="${esc(env.SITE_URL)}/og.png"><meta property="og:url" content="${esc(url)}"><meta name="twitter:card" content="summary_large_image">`,
    body: `<div class="grid"><div class="cert">${renderCertificate(d)}</div><div>
<h1>${esc(o.recipient_name)}, masz dobrą pogodę ☀️</h1><p class="sub">${esc(o.purchaser_name)} oficjalnie zamówił(a) ją dla Ciebie. ${esc(o.location)}, ${esc(d.dateLabel)}.</p>
<div class="acts"><button class="btn sun" id="share" data-url="${esc(url)}">UDOSTĘPNIJ</button><a class="btn ghost" id="pdf" href="/c/${esc(o.cert_token)}/pdf">POBIERZ PDF</a></div>
<p class="note">Też chcesz komuś kupić pogodę? <a href="/">Kup dobrą pogodę</a>.</p>
<p class="note">Pogoda nie dotrzymała umowy? <a href="/reklamacja?o=${esc(o.order_id)}">Zgłoś reklamację</a>.</p>
</div></div>${trackScript("certificate_viewed", o.order_id)}${shareScript}`,
  });
}

export function refundPage(prefillOrder = ""): string {
  return page({
    title: "Reklamacja zamówionej pogody",
    body: `<h1>Reklamacja zamówionej pogody</h1>
<p class="sub">Zamówiłeś słońce, a była ulewa? Nie tak się umawialiśmy. Opisz krótko, co poszło nie tak.</p>
<form class="card" id="rf">
<label class="f">Numer zamówienia<input name="orderId" id="orderId" required placeholder="KPG-XXXXXX" value="${esc(prefillOrder)}" autocomplete="off"></label>
<label class="f">E-mail użyty przy zamówieniu<input name="email" id="email" type="email" required autocomplete="email"></label>
<label class="f">Co się stało?<textarea name="reason" id="reason" required maxlength="500" placeholder="np. „Zamówiłem słońce. Była ulewa.”"></textarea></label>
<button class="btn sun" type="submit" id="send">WYŚLIJ REKLAMACJĘ</button>
<div class="msg" id="out" hidden></div>
<p class="note">Zasady Gwarancji Pogody: reklamację można zgłosić od zamówionej daty do 14 dni po niej. Szczegóły w <a href="/regulamin">Regulaminie</a>.</p>
</form>
<script>
var f = document.getElementById("rf"), out = document.getElementById("out"), btn = document.getElementById("send");
f.addEventListener("submit", async function (e) {
  e.preventDefault(); btn.disabled = true; out.hidden = true;
  try {
    var r = await fetch("/api/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(f))) });
    var j = await r.json(); out.textContent = j.message; out.className = "msg " + (r.ok ? "ok" : "err"); out.hidden = false;
    if (r.ok) { f.querySelectorAll("input,textarea").forEach(function (i) { i.disabled = true; }); btn.hidden = true; } else btn.disabled = false;
  } catch (err) { out.textContent = "Nie udało się wysłać. Sprawdź połączenie i spróbuj ponownie."; out.className = "msg err"; out.hidden = false; btn.disabled = false; }
});
</script>`,
  });
}

export function notFoundPage(): string {
  return page({ title: "Nie znaleziono", body: `<h1>Tej pogody tu nie ma.</h1><p class="sub">Link jest niepełny albo zamówienie nie istnieje. <a href="/">Wróć na stronę główną</a>.</p>` });
}

export function messagePage(title: string, text: string): string {
  return page({ title, body: `<h1>${esc(title)}</h1><p class="sub">${esc(text)}</p><p class="note"><a href="javascript:history.back()">Wróć</a></p>` });
}
