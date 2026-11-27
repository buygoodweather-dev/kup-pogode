declare module "*.ttf" { const data: ArrayBuffer; export default data; }
declare module "@pdf-lib/fontkit" { const fontkit: any; export default fontkit; }
declare module "../public/cert.js" {
  export const TEMPERATURES: string[];
  export const CONDITIONS: string[];
  export const MESSAGE_MAX: number;
  export const LANGS: string[];
  export const CERT: { width: number; height: number };
  export type CertText = { title: string; headline: string; intro: string; place: string; date: string; temp: string; weather: string; by: string; ring: string; paid: string; paid2: string; no: string; fine: string };
  export const CERT_TEXT: Record<string, CertText>;
  export function normLang(l: unknown): string;
  export function condLabel(c: string, lang: string): string;
  export function formatDate(iso: string, lang?: string): string;
  export function formatDatePL(iso: string): string;
  export function esc(s: unknown): string;
  export function wrapText(t: string, maxChars: number, maxLines: number): string[];
  export function certificateLayout(d: any): { name: string; nameSize: number; condLines: string[]; extra: number; msgLines: string[]; t: CertText };
  export function renderCertificate(d: any): string;
}
declare module "../public/greetings.js" {
  export const STYLES: { key: string; emoji: string; label: Record<string, string>; brief: string }[];
  export const STYLE_KEYS: string[];
  export const GREETINGS: Record<string, Record<string, string[]>>;
  export function pickGreeting(lang: string, style: string, current?: string): string;
}
