declare module "*.ttf" { const data: ArrayBuffer; export default data; }
declare module "@pdf-lib/fontkit" { const fontkit: any; export default fontkit; }
declare module "../public/cert.js" {
  export const TEMPERATURES: string[];
  export const CONDITIONS: string[];
  export const MESSAGE_MAX: number;
  export const CERT: { width: number; height: number };
  export function formatDatePL(iso: string): string;
  export function esc(s: unknown): string;
  export function wrapText(t: string, maxChars: number, maxLines: number): string[];
  export function certificateLayout(d: any): { name: string; nameSize: number; condLines: string[]; extra: number; msgLines: string[] };
  export function renderCertificate(d: any): string;
}
