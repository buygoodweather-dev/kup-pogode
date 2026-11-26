const ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I to avoid typos when people copy the number

export function randomId(len: number, alphabet = ID_ALPHABET): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
export const newOrderId = () => "KPG-" + randomId(6);
export function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const nowIso = () => new Date().toISOString();

/** Today's date in Poland as YYYY-MM-DD. */
export function todayWarsaw(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const formatPLN = (grosze: number) => (grosze / 100).toFixed(2).replace(".", ",") + " zł";

/** Pick one value from "a,b,c" (A/B tests); keeps a previous choice if it is still valid. */
export function pickVariant(list: string, previous?: string | null): string {
  const opts = list.split(",").map((s) => s.trim()).filter(Boolean);
  if (previous && opts.includes(previous)) return previous;
  return opts[Math.floor(Math.random() * opts.length)] ?? opts[0];
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function deviceFromUA(ua: string | null): string {
  if (!ua) return "unknown";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}
