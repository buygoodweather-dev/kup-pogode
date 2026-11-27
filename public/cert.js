// Shared by the browser (live preview) and the worker (certificate page, PDF layout).
// One template means the preview and the delivered certificate always look the same.

export const TEMPERATURES = ["15–18°C", "19–22°C", "23–26°C", "27–30°C"];
// Stored values are the Polish names; other languages only change how they are shown.
export const CONDITIONS = ["Słońce", "Lekkie chmury", "Bez deszczu", "Przyjemnie ciepło"];
export const MESSAGE_MAX = 180;
export const LANGS = ["pl", "uk", "en"];
export const normLang = (l) => (LANGS.includes(l) ? l : "pl");

const COND_LABELS = {
  uk: { "Słońce": "Сонце", "Lekkie chmury": "Легкі хмарки", "Bez deszczu": "Без дощу", "Przyjemnie ciepło": "Приємно тепло" },
  en: { "Słońce": "Sunshine", "Lekkie chmury": "Light clouds", "Bez deszczu": "No rain", "Przyjemnie ciepło": "Pleasantly warm" },
};
export const condLabel = (c, lang) => COND_LABELS[lang]?.[c] ?? c;

const MONTHS = {
  pl: ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"],
  uk: ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
/** "2027-06-15" -> "15 czerwca 2027" / "15 червня 2027" / "15 June 2027" (no time zones involved). */
export function formatDate(isoDate, lang = "pl") {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
  if (!m) return "";
  return `${Number(m[3])} ${MONTHS[normLang(lang)][Number(m[2]) - 1]} ${m[1]}`;
}
export const formatDatePL = (isoDate) => formatDate(isoDate, "pl");

const QUOTES = { pl: ["„", "”"], uk: ["«", "»"], en: ["“", "”"] };

/** Fixed texts printed on the certificate (SVG and PDF). */
export const CERT_TEXT = {
  pl: { title: "OFICJALNY CERTYFIKAT ZAKUPU POGODY", headline: "Dobra pogoda", intro: "Niniejszym potwierdza się zakup dobrej pogody dla", place: "MIEJSCE", date: "DATA", temp: "TEMPERATURA", weather: "POGODA", by: "KUPIONE PRZEZ", ring: "ZAMÓWIONO OFICJALNIE · KUP POGODĘ ·", paid: "OPŁACONO", paid2: "W CAŁOŚCI", no: "CERTYFIKAT NR", fine: "Zamówienie ma charakter symboliczny i rozrywkowy. Atmosfera nie została poinformowana." },
  uk: { title: "ОФІЦІЙНИЙ СЕРТИФІКАТ КУПІВЛІ ПОГОДИ", headline: "Гарна погода", intro: "Гарну погоду офіційно придбано на ім’я", place: "МІСЦЕ", date: "ДАТА", temp: "ТЕМПЕРАТУРА", weather: "ПОГОДА", by: "ПОКУПЕЦЬ", ring: "ЗАМОВЛЕНО ОФІЦІЙНО · KUP POGODĘ ·", paid: "СПЛАЧЕНО", paid2: "ПОВНІСТЮ", no: "СЕРТИФІКАТ №", fine: "Замовлення має символічний і розважальний характер. Атмосферу не повідомлено." },
  en: { title: "OFFICIAL WEATHER PURCHASE CERTIFICATE", headline: "Good weather", intro: "This certifies the purchase of good weather for", place: "PLACE", date: "DATE", temp: "TEMPERATURE", weather: "WEATHER", by: "PURCHASED BY", ring: "OFFICIALLY ORDERED · KUP POGODĘ ·", paid: "PAID", paid2: "IN FULL", no: "CERTIFICATE NO.", fine: "This order is symbolic and just for fun. The atmosphere has not been informed." },
};

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Greedy word wrap by character count; adds "…" when text does not fit. */
export function wrapText(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  let used = 0;
  for (const w of words) {
    if (cur && (cur + " " + w).length > maxChars) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = cur ? cur + " " + w : w;
    }
    used++;
  }
  if (lines.length < maxLines && cur) { lines.push(cur); cur = ""; }
  const truncated = used < words.length || (lines.length === maxLines && cur);
  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    if (last.length > maxChars - 1) last = last.slice(0, maxChars - 1);
    lines[lines.length - 1] = last.replace(/[\s,.;:–-]+$/, "") + "…";
  }
  return lines.map((l) => (l.length > maxChars ? l.slice(0, maxChars - 1) + "…" : l));
}

/** Layout numbers used by both the SVG and the PDF renderer. */
export function certificateLayout(d) {
  const name = d.recipient || "…";
  const nameSize = name.length > 22 ? 34 : name.length > 14 ? 46 : 62;
  const lang = normLang(d.lang);
  const condLines = wrapText(d.conditions && d.conditions.length ? d.conditions.map((c) => condLabel(c, lang)).join(" · ") : "—", 34, 2);
  const extra = (condLines.length - 1) * 26;
  const [qo, qc] = QUOTES[lang];
  const msgLines = d.message ? wrapText(qo + d.message + qc, 44, 3) : [];
  return { name, nameSize, condLines, extra, msgLines, t: CERT_TEXT[lang] };
}

export const CERT = { width: 600, height: 840 };

export function renderCertificate(d) {
  const { name, nameSize, condLines, extra, msgLines, t } = certificateLayout(d);
  const row = (y, label, value) => `
    <text x="70" y="${y}" font-family="Manrope, sans-serif" font-size="11" font-weight="700" letter-spacing="2" fill="#8A7A55">${label}</text>
    <text x="530" y="${y}" text-anchor="end" font-family="'Cormorant Garamond', Georgia, serif" font-size="23" font-weight="600" fill="#1B2130">${esc(value)}</text>
    <line x1="70" y1="${y + 14}" x2="530" y2="${y + 14}" stroke="#E5D8BA" stroke-width="1"/>`;
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return `<line x1="${(Math.cos(a) * 30).toFixed(1)}" y1="${(Math.sin(a) * 30).toFixed(1)}" x2="${(Math.cos(a) * 38).toFixed(1)}" y2="${(Math.sin(a) * 38).toFixed(1)}" stroke="#F2A61F" stroke-width="2.5" stroke-linecap="round"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 840" role="img" aria-label="Certyfikat zakupu pogody dla ${esc(name)}">
  <defs>
    <path id="sealPath" d="M 0,0 m -46,0 a 46,46 0 1,1 92,0 a 46,46 0 1,1 -92,0"/>
    <radialGradient id="sunG" cx="40%" cy="38%" r="70%"><stop offset="0" stop-color="#FFD98A"/><stop offset="1" stop-color="#F2A61F"/></radialGradient>
  </defs>
  <rect width="600" height="840" fill="#FFFCF4"/>
  <rect x="22" y="22" width="556" height="796" fill="none" stroke="#C9B383" stroke-width="1.5"/>
  <rect x="32" y="32" width="536" height="776" fill="none" stroke="#C9B383" stroke-width="0.75"/>
  <g transform="translate(300 96)"><circle r="22" fill="url(#sunG)"/>${rays}</g>
  <text x="300" y="168" text-anchor="middle" font-family="'Bricolage Grotesque', sans-serif" font-size="14" font-weight="800" letter-spacing="4" fill="#1B2130">KUP POGODĘ</text>
  <text x="300" y="196" text-anchor="middle" font-family="Manrope, sans-serif" font-size="10.5" font-weight="700" letter-spacing="2.6" fill="#8A7A55">${t.title}</text>
  <text x="300" y="250" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="44" font-weight="700" fill="#1B2130">${t.headline}</text>
  <text x="300" y="284" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-style="italic" font-size="17" fill="#5A6474">${t.intro}</text>
  <text x="300" y="${(342 + (62 - nameSize) / 3).toFixed(1)}" text-anchor="middle" font-family="'Great Vibes', cursive" font-size="${nameSize}" fill="#1B2130">${esc(name)}</text>
  <line x1="150" y1="364" x2="450" y2="364" stroke="#C9B383" stroke-width="1"/>
  ${row(408, t.place, d.place || "…")}
  ${row(452, t.date, d.dateLabel || "…")}
  ${row(496, t.temp, d.temp || "…")}
  <text x="70" y="540" font-family="Manrope, sans-serif" font-size="11" font-weight="700" letter-spacing="2" fill="#8A7A55">${t.weather}</text>
  ${condLines.map((l, i) => `<text x="530" y="${540 + i * 26}" text-anchor="end" font-family="'Cormorant Garamond', Georgia, serif" font-size="23" font-weight="600" fill="#1B2130">${esc(l)}</text>`).join("")}
  <line x1="70" y1="${554 + extra}" x2="530" y2="${554 + extra}" stroke="#E5D8BA" stroke-width="1"/>
  ${msgLines.map((l, i) => `<text x="300" y="${612 + extra * 0.77 + i * 24}" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-style="italic" font-size="20" fill="#3B4354">${esc(l)}</text>`).join("")}
  <text x="70" y="724" font-family="Manrope, sans-serif" font-size="10" font-weight="700" letter-spacing="2" fill="#8A7A55">${t.by}</text>
  <text x="70" y="756" font-family="'Great Vibes', cursive" font-size="30" fill="#1B2130">${esc(d.buyer || "…")}</text>
  <g transform="translate(470 728) rotate(-12)">
    <circle r="56" fill="none" stroke="#B8862B" stroke-width="2"/>
    <circle r="40" fill="none" stroke="#B8862B" stroke-width="1"/>
    <text font-family="Manrope, sans-serif" font-size="9.5" font-weight="800" letter-spacing="2.2" fill="#B8862B"><textPath href="#sealPath">${t.ring}</textPath></text>
    <text y="-2" text-anchor="middle" font-family="'Bricolage Grotesque', Manrope, sans-serif" font-size="12" font-weight="800" fill="#B8862B">${t.paid}</text>
    <text y="13" text-anchor="middle" font-family="Manrope, sans-serif" font-size="8" font-weight="700" letter-spacing="1" fill="#B8862B">${t.paid2}</text>
  </g>
  <text x="300" y="792" text-anchor="middle" font-family="Manrope, sans-serif" font-size="10" font-weight="700" letter-spacing="1.6" fill="#8A7A55">${t.no} ${esc(d.certNo || "KPG-······")}</text>
  <text x="300" y="808" text-anchor="middle" font-family="Manrope, sans-serif" font-size="7.5" fill="#A39674">${t.fine}</text>
</svg>`;
}
