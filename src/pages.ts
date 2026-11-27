import type { Env, Order } from "./env";
import { esc, formatDate, condLabel, renderCertificate } from "../public/cert.js";
import { HTML_LANG, t, type Lang } from "./i18n";

const FONTS = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Manrope:wght@400;600;700;800&family=Cormorant+Garamond:ital,wght@0,600;0,700;1,500&family=Great+Vibes&display=swap";

export function page(opts: { title: string; body: string; head?: string; noindex?: boolean; lang?: Lang }): string {
  const lang = opts.lang ?? "pl";
  return `<!doctype html><html lang="${HTML_LANG[lang]}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(opts.title)}</title>${opts.noindex !== false ? '<meta name="robots" content="noindex">' : ""}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/pages.css">${opts.head ?? ""}</head>
<body><header class="site"><div class="wrap"><a class="logo" href="/"><i aria-hidden="true"></i>KUP POGODĘ</a></div></header>
<main><div class="wrap">${opts.body}</div></main>
<footer><div class="wrap">${t(lang, "footer")}</div></footer>
</body></html>`;
}

export const orderLang = (o: Order): Lang => (o.lang === "uk" || o.lang === "en" ? o.lang : "pl");

export function certData(o: Order) {
  const lang = orderLang(o);
  return {
    lang,
    recipient: o.recipient_name,
    place: o.location,
    dateLabel: formatDate(o.weather_date, lang),
    temp: o.temperature,
    conditions: JSON.parse(o.weather_preferences) as string[],
    message: o.personal_message ?? "",
    buyer: o.purchaser_name,
    certNo: o.order_id,
  };
}

const trackScript = (name: string, orderId: string) =>
  `<script>(function(){function t(n){try{navigator.sendBeacon("/api/event",new Blob([JSON.stringify({name:n,orderId:${JSON.stringify(orderId)},path:location.pathname})],{type:"application/json"}))}catch(e){}}window.kpTrack=t;t(${JSON.stringify(name)});})();</script>`;

const shareScript = (lang: Lang) => `<script>
var KP_S = ${JSON.stringify({ title: t(lang, "shareTitle"), copied: t(lang, "copied"), prompt: t(lang, "copyPrompt") })};
document.getElementById("share")?.addEventListener("click", async function () {
  var url = this.dataset.url;
  window.kpTrack && kpTrack("certificate_shared");
  if (navigator.share) { try { await navigator.share({ title: KP_S.title, text: KP_S.title, url: url }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(url); this.textContent = KP_S.copied; } catch (e) { prompt(KP_S.prompt, url); }
});
document.getElementById("pdf")?.addEventListener("click", function () { window.kpTrack && kpTrack("certificate_downloaded"); });
</script>`;

/** Success page after Stripe redirects back. Waits for the webhook when needed. Shown in the order's language. */
export function successPage(env: Env, o: Order, sessionId: string): string {
  const lang = orderLang(o);
  if (o.status !== "paid") {
    return page({
      lang,
      title: t(lang, "waitTitle"),
      head: `<meta http-equiv="refresh" content="3">`,
      body: `<div style="display:grid;gap:18px;justify-items:start;max-width:560px"><div class="spinner" aria-hidden="true"></div>
<h1>${esc(t(lang, "waitH1"))}</h1><p class="sub">${esc(t(lang, "waitText", { order: o.order_id }))}</p>
<p class="note">${esc(t(lang, "waitNote", { email: o.purchaser_email }))}</p></div>`,
    });
  }
  const url = `${env.SITE_URL.replace(/\/$/, "")}/c/${o.cert_token}`;
  const d = certData(o);
  const emails = esc(o.purchaser_email) + (o.recipient_email ? esc(t(lang, "and")) + esc(o.recipient_email) : "");
  return page({
    lang,
    title: t(lang, "okTitle"),
    body: `<div class="grid"><div>
<h1>${esc(t(lang, "okTitle"))}</h1><p class="sub">${esc(t(lang, "okSub"))}</p>
<dl class="kv"><dt>${esc(t(lang, "kOrder"))}</dt><dd>${esc(o.order_id)}</dd><dt>${esc(t(lang, "kFor"))}</dt><dd>${esc(o.recipient_name)}</dd><dt>${esc(t(lang, "kPlace"))}</dt><dd>${esc(o.location)}</dd><dt>${esc(t(lang, "kDate"))}</dt><dd>${esc(d.dateLabel)}</dd><dt>${esc(t(lang, "kWeather"))}</dt><dd>${esc(o.temperature)} · ${esc(d.conditions.map((c) => condLabel(c, lang)).join(", "))}</dd></dl>
<div class="acts"><button class="btn sun" id="share" data-url="${esc(url)}">${esc(t(lang, "send"))}</button><a class="btn ghost" id="pdf" href="/c/${esc(o.cert_token)}/pdf">${esc(t(lang, "pdf"))}</a><a class="btn ghost" href="/c/${esc(o.cert_token)}">${esc(t(lang, "show"))}</a></div>
<form method="post" action="/api/resend" style="margin-top:12px"><input type="hidden" name="o" value="${esc(o.order_id)}"><input type="hidden" name="s" value="${esc(sessionId)}"><button class="btn small ghost" type="submit">${esc(t(lang, "resend"))}</button></form>
<p class="note">${t(lang, "sentTo", { emails })}</p>
</div><div class="cert">${renderCertificate(d)}</div></div>${trackScript("certificate_viewed", o.order_id)}${shareScript(lang)}`,
  });
}

/** Public certificate page (the link people share), in the order's language. */
export function certificatePage(env: Env, o: Order): string {
  const lang = orderLang(o);
  const url = `${env.SITE_URL.replace(/\/$/, "")}/c/${o.cert_token}`;
  const d = certData(o);
  const v = { name: esc(o.recipient_name), buyer: esc(o.purchaser_name), place: esc(o.location), date: esc(d.dateLabel), order: esc(o.order_id) };
  return page({
    lang,
    title: t(lang, "certTitle", { name: o.recipient_name }),
    head: `<meta property="og:title" content="${esc(t(lang, "ogTitle", { name: o.recipient_name }))}"><meta property="og:description" content="${esc(t(lang, "ogDesc", { place: o.location, date: d.dateLabel }))}"><meta property="og:image" content="${esc(env.SITE_URL)}/og.png"><meta property="og:url" content="${esc(url)}"><meta name="twitter:card" content="summary_large_image">`,
    body: `<div class="grid"><div class="cert">${renderCertificate(d)}</div><div>
<h1>${t(lang, "certH1", v)}</h1><p class="sub">${t(lang, "certSub", v)}</p>
<div class="acts"><button class="btn sun" id="share" data-url="${esc(url)}">${esc(t(lang, "share"))}</button><a class="btn ghost" id="pdf" href="/c/${esc(o.cert_token)}/pdf">${esc(t(lang, "pdf"))}</a></div>
<p class="note">${t(lang, "alsoBuy")}</p>
<p class="note">${t(lang, "complain", { order: v.order })}</p>
</div></div>${trackScript("certificate_viewed", o.order_id)}${shareScript(lang)}`,
  });
}

export function refundPage(lang: Lang, prefillOrder = ""): string {
  return page({
    lang,
    title: t(lang, "rTitle"),
    body: `<h1>${esc(t(lang, "rTitle"))}</h1>
<p class="sub">${esc(t(lang, "rSub"))}</p>
<form class="card" id="rf">
<label class="f">${esc(t(lang, "rOrder"))}<input name="orderId" id="orderId" required placeholder="KPG-XXXXXX" value="${esc(prefillOrder)}" autocomplete="off"></label>
<label class="f">${esc(t(lang, "rEmail"))}<input name="email" id="email" type="email" required autocomplete="email"></label>
<label class="f">${esc(t(lang, "rWhat"))}<textarea name="reason" id="reason" required maxlength="500" placeholder="${esc(t(lang, "rWhatPh"))}"></textarea></label>
<button class="btn sun" type="submit" id="send">${esc(t(lang, "rSend"))}</button>
<div class="msg" id="out" hidden></div>
<p class="note">${t(lang, "rNote")}</p>
</form>
<script>
var f = document.getElementById("rf"), out = document.getElementById("out"), btn = document.getElementById("send");
f.addEventListener("submit", async function (e) {
  e.preventDefault(); btn.disabled = true; out.hidden = true;
  try {
    var r = await fetch("/api/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign(Object.fromEntries(new FormData(f)), { lang: ${JSON.stringify(lang)} })) });
    var j = await r.json(); out.textContent = j.message; out.className = "msg " + (r.ok ? "ok" : "err"); out.hidden = false;
    if (r.ok) { f.querySelectorAll("input,textarea").forEach(function (i) { i.disabled = true; }); btn.hidden = true; } else btn.disabled = false;
  } catch (err) { out.textContent = ${JSON.stringify(t(lang, "rOffline"))}; out.className = "msg err"; out.hidden = false; btn.disabled = false; }
});
</script>`,
  });
}

export function notFoundPage(lang: Lang = "pl"): string {
  return page({ lang, title: t(lang, "nfTitle"), body: `<h1>${esc(t(lang, "nfH1"))}</h1><p class="sub">${t(lang, "nfText")}</p>` });
}

export function messagePage(title: string, text: string, lang: Lang = "pl"): string {
  return page({ lang, title, body: `<h1>${esc(title)}</h1><p class="sub">${esc(text)}</p><p class="note"><a href="javascript:history.back()">${esc(t(lang, "back"))}</a></p>` });
}
