import { PDFDocument, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { certificateLayout, CERT } from "../public/cert.js";

export interface CertFonts { serif: ArrayBuffer; serifBold: ArrayBuffer; serifItalic: ArrayBuffer; sans: ArrayBuffer; sansBold: ArrayBuffer; script: ArrayBuffer }
export interface CertData { recipient: string; place: string; dateLabel: string; temp: string; conditions: string[]; message: string; buyer: string; certNo: string; lang?: string }

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const INK = hex("#1B2130"), GOLD = hex("#8A7A55"), RULE = hex("#E5D8BA"), FRAME = hex("#C9B383"), SEAL = hex("#B8862B"), SUN = hex("#F2A61F");

/** Draws the same layout as renderCertificate() in public/cert.js (SVG units = PDF points, y flipped). */
export async function certificatePdf(d: CertData, fonts: CertFonts): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`KUP POGODĘ ${d.certNo}`);
  doc.setAuthor("KUP POGODĘ");
  const [serif, serifBold, serifItalic, sans, sansBold, script] = await Promise.all([
    doc.embedFont(fonts.serif, { subset: true }), doc.embedFont(fonts.serifBold, { subset: true }), doc.embedFont(fonts.serifItalic, { subset: true }),
    doc.embedFont(fonts.sans, { subset: true }), doc.embedFont(fonts.sansBold, { subset: true }), doc.embedFont(fonts.script, { subset: true }),
  ]);
  const page = doc.addPage([CERT.width, CERT.height]);
  const Y = (y: number) => CERT.height - y;
  // fonts carry Latin, Polish and Cyrillic: drop emoji and other glyphs they cannot draw
  const keep = (font: PDFFont, s: string) => { const set = new Set(font.getCharacterSet()); return [...s].filter((ch) => set.has(ch.codePointAt(0)!)).join("").replace(/\s+/g, " ").trim(); };
  const text = (p: PDFPage, raw: string, x: number, y: number, font: PDFFont, size: number, color = INK, align: "left" | "center" | "right" = "left", spacing = 0) => {
    const s = keep(font, raw);
    const w = font.widthOfTextAtSize(s, size) + spacing * Math.max(0, s.length - 1);
    const x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    if (!spacing) return p.drawText(s, { x: x0, y: Y(y), size, font, color });
    let cx = x0;
    for (const ch of s) { p.drawText(ch, { x: cx, y: Y(y), size, font, color }); cx += font.widthOfTextAtSize(ch, size) + spacing; }
  };
  const line = (x1: number, y1: number, x2: number, y2: number, color = RULE, thickness = 1) => page.drawLine({ start: { x: x1, y: Y(y1) }, end: { x: x2, y: Y(y2) }, color, thickness });

  const { name, nameSize, condLines, extra, msgLines, t } = certificateLayout(d);
  page.drawRectangle({ x: 0, y: 0, width: CERT.width, height: CERT.height, color: hex("#FFFCF4") });
  page.drawRectangle({ x: 22, y: 22, width: 556, height: 796, borderColor: FRAME, borderWidth: 1.5 });
  page.drawRectangle({ x: 32, y: 32, width: 536, height: 776, borderColor: FRAME, borderWidth: 0.75 });
  page.drawCircle({ x: 300, y: Y(96), size: 22, color: SUN });
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    page.drawLine({ start: { x: 300 + Math.cos(a) * 30, y: Y(96 + Math.sin(a) * 30) }, end: { x: 300 + Math.cos(a) * 38, y: Y(96 + Math.sin(a) * 38) }, color: SUN, thickness: 2.5, lineCap: 1 });
  }
  text(page, "KUP POGODĘ", 300, 168, sansBold, 14, INK, "center", 4);
  text(page, t.title, 300, 196, sansBold, 10.5, GOLD, "center", 2.6);
  text(page, t.headline, 300, 250, serifBold, 44, INK, "center");
  text(page, t.intro, 300, 284, serifItalic, 17, hex("#5A6474"), "center");
  text(page, name, 300, 342 + (62 - nameSize) / 3, script, nameSize, INK, "center");
  line(150, 364, 450, 364, FRAME);
  const row = (y: number, label: string, value: string) => { text(page, label, 70, y, sansBold, 11, GOLD, "left", 2); text(page, value, 530, y, serif, 23, INK, "right"); line(70, y + 14, 530, y + 14); };
  row(408, t.place, d.place);
  row(452, t.date, d.dateLabel);
  row(496, t.temp, d.temp);
  text(page, t.weather, 70, 540, sansBold, 11, GOLD, "left", 2);
  condLines.forEach((l: string, i: number) => text(page, l, 530, 540 + i * 26, serif, 23, INK, "right"));
  line(70, 554 + extra, 530, 554 + extra);
  msgLines.forEach((l: string, i: number) => text(page, l, 300, 612 + extra * 0.77 + i * 24, serifItalic, 20, hex("#3B4354"), "center"));
  text(page, t.by, 70, 724, sansBold, 10, GOLD, "left", 2);
  text(page, d.buyer, 70, 756, script, 30);
  // seal
  page.drawCircle({ x: 470, y: Y(728), size: 56, borderColor: SEAL, borderWidth: 2 });
  page.drawCircle({ x: 470, y: Y(728), size: 40, borderColor: SEAL, borderWidth: 1 });
  const ring = t.ring + " ";
  const per = (2 * Math.PI) / ring.length;
  [...ring].forEach((ch, i) => {
    const a = Math.PI / 2 + 0.2 - i * per; // clockwise from the top
    page.drawText(ch, { x: 470 + Math.cos(a) * 44 - 3, y: Y(728) + Math.sin(a) * 44 - 3, size: 8.5, font: sansBold, color: SEAL, rotate: degrees((a * 180) / Math.PI - 90) });
  });
  text(page, t.paid, 470, 726, sansBold, 11, SEAL, "center");
  text(page, t.paid2, 470, 740, sansBold, 7.5, SEAL, "center", 1);
  text(page, `${t.no} ${d.certNo}`, 300, 792, sansBold, 10, GOLD, "center", 1.6);
  text(page, t.fine, 300, 808, sans, 7.5, hex("#A39674"), "center");
  return doc.save();
}
