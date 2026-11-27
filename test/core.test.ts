import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { verifyStripeSignature, signStripePayload, stripeForm } from "../src/stripe";
import { CheckoutSchema, RefundSchema } from "../src/validation";
import { decideRefund } from "../src/refunds";
import { renderCertificate, formatDatePL, formatDate, wrapText } from "../public/cert.js";
import { GREETINGS, STYLE_KEYS, pickGreeting } from "../public/greetings.js";
import { langFromHeader, pickLang, LANDING, CLIENT, t } from "../src/i18n";
import { cleanGreeting, makeGreeting } from "../src/greeting";
import { GreetingSchema } from "../src/validation";
import { certificatePdf } from "../src/pdf";
import { newOrderId, addDays, todayWarsaw } from "../src/util";
import type { Order } from "../src/env";

const future = addDays(todayWarsaw(), 30);
const valid = { forMe: false, recipient: "Ania", recipientEmail: "", place: "Kraków", date: future, temp: "23–26°C", conditions: ["Słońce", "Bez deszczu"], message: "Na weekend ❤️", buyer: "Łukasz", email: "Lukasz@Example.com", terms: true, instant: true };

describe("stripe signature", () => {
  it("accepts a valid signature and rejects tampering, wrong secret and old timestamps", async () => {
    const body = '{"id":"evt_1"}';
    const h = await signStripePayload(body, "whsec_test");
    expect(await verifyStripeSignature(body, h, "whsec_test")).toBe(true);
    expect(await verifyStripeSignature(body + " ", h, "whsec_test")).toBe(false);
    expect(await verifyStripeSignature(body, h, "whsec_other")).toBe(false);
    const old = await signStripePayload(body, "whsec_test", Math.floor(Date.now() / 1000) - 3600);
    expect(await verifyStripeSignature(body, old, "whsec_test")).toBe(false);
    expect(await verifyStripeSignature(body, null, "whsec_test")).toBe(false);
  });
  it("encodes nested params", () => {
    expect(stripeForm({ a: [{ b: { c: 1 } }], d: "x" }).toString()).toBe("a%5B0%5D%5Bb%5D%5Bc%5D=1&d=x");
  });
});

describe("checkout validation", () => {
  it("accepts a normal order and normalises e-mail", () => {
    const r = CheckoutSchema.parse(valid);
    expect(r.email).toBe("lukasz@example.com");
    expect(r.recipient).toBe("Ania");
  });
  it("uses the buyer as recipient for 'Dla mnie'", () => {
    expect(CheckoutSchema.parse({ ...valid, forMe: true, recipient: "" }).recipient).toBe("Łukasz");
  });
  it.each([
    ["missing place", { place: "  " }],
    ["past date", { date: "2020-01-01" }],
    ["bad temperature", { temp: "99°C" }],
    ["unknown condition", { conditions: ["Tornado"] }],
    ["no conditions", { conditions: [] }],
    ["bad e-mail", { email: "nope" }],
    ["terms not accepted", { terms: false }],
    ["message too long", { message: "x".repeat(181) }],
    ["no recipient", { recipient: "" }],
  ])("rejects %s", (_n, patch) => {
    expect(CheckoutSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it("strips control characters and collapses spaces", () => {
    expect(CheckoutSchema.parse({ ...valid, place: " Kra\u0000ków \n\n Rynek " }).place).toBe("Kra ków Rynek");
  });
  it("accepts a custom temperature", () => {
    expect(CheckoutSchema.safeParse({ ...valid, temp: "-5°C" }).success).toBe(true);
  });
  it("normalises refund order numbers", () => {
    expect(RefundSchema.parse({ orderId: "kpg4f7q2k", email: "a@b.pl", reason: "Była ulewa" }).orderId).toBe("KPG-4F7Q2K");
  });
});

describe("Gwarancja Pogody rules", () => {
  const o = { status: "paid", refund_status: "none", weather_date: "2027-06-15", payment_id: "pi_1" } as Order;
  it("refunds automatically inside the window", () => expect(decideRefund(o, "2027-06-15", 0, true).kind).toBe("auto"));
  it("rejects before the weather date", () => expect(decideRefund(o, "2027-06-14", 0, true).kind).toBe("reject"));
  it("rejects after 14 days", () => expect(decideRefund(o, "2027-06-30", 0, true).kind).toBe("reject"));
  it("allows day 14", () => expect(decideRefund(o, "2027-06-29", 0, true).kind).toBe("auto"));
  it("sends repeat refunds to review", () => expect(decideRefund(o, "2027-06-16", 1, true).kind).toBe("review"));
  it("rejects a second request", () => expect(decideRefund({ ...o, refund_status: "review" }, "2027-06-16", 0, true).kind).toBe("reject"));
  it("rejects unpaid orders", () => expect(decideRefund({ ...o, status: "pending" }, "2027-06-16", 0, true).kind).toBe("reject"));
  it("uses review when auto refunds are off", () => expect(decideRefund(o, "2027-06-16", 0, false).kind).toBe("review"));
});

describe("certificate", () => {
  it("escapes user input in the SVG", () => {
    const svg = renderCertificate({ recipient: '<script>alert(1)</script>', place: 'a"b', conditions: ["Słońce"], buyer: "x", message: "<b>hi</b>" });
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("<b>hi");
    expect(svg).toContain("&lt;script&gt;");
  });
  it("formats Polish dates", () => {
    expect(formatDatePL("2027-06-15")).toBe("15 czerwca 2027");
    expect(formatDatePL("2026-09-01")).toBe("1 września 2026");
  });
  it("wraps long messages into at most 3 lines with an ellipsis", () => {
    const lines = wrapText("słowo ".repeat(60), 44, 3);
    expect(lines.length).toBe(3);
    expect(lines[2].endsWith("…")).toBe(true);
    lines.forEach((l: string) => expect(l.length).toBeLessThanOrEqual(44));
  });
  it("builds a PDF with Polish characters", async () => {
    const f = (n: string) => readFileSync(new URL(`../assets/fonts/${n}`, import.meta.url)).buffer as ArrayBuffer;
    const pdf = await certificatePdf(
      { recipient: "Małgorzata Żółkiewska", place: "Świnoujście", dateLabel: "15 czerwca 2027", temp: "23–26°C", conditions: ["Słońce", "Bez deszczu"], message: "Zażółć gęślą jaźń ❤️ 😀", buyer: "Łukasz", certNo: "KPG-4F7Q2K" },
      { serif: f("CG-600.sub.ttf"), serifBold: f("CG-700.sub.ttf"), serifItalic: f("CG-500i.sub.ttf"), sans: f("MR-500.sub.ttf"), sansBold: f("MR-700.sub.ttf"), script: f("GV.sub.ttf") },
    );
    expect(pdf.length).toBeGreaterThan(10_000);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});

describe("ids", () => {
  it("makes readable order numbers", () => expect(newOrderId()).toMatch(/^KPG-[2-9A-HJ-NP-Z]{6}$/));
});

const fontFile = (n: string) => readFileSync(new URL(`../assets/fonts/${n}`, import.meta.url)).buffer as ArrayBuffer;
const FONTS = { serif: fontFile("CG-600.sub.ttf"), serifBold: fontFile("CG-700.sub.ttf"), serifItalic: fontFile("CG-500i.sub.ttf"), sans: fontFile("MR-500.sub.ttf"), sansBold: fontFile("MR-700.sub.ttf"), script: fontFile("GV.sub.ttf") };

describe("languages", () => {
  it("picks the visitor's language", () => {
    expect(langFromHeader("uk-UA,uk;q=0.9,en;q=0.8")).toBe("uk");
    expect(langFromHeader("de-DE,de;q=0.9,pl;q=0.5")).toBe("pl");
    expect(langFromHeader("de-DE,de;q=0.9")).toBe("en");
    expect(langFromHeader("en-GB")).toBe("en");
    expect(langFromHeader(null)).toBe("pl");
    expect(pickLang("en", "uk", "pl")).toBe("en");
    expect(pickLang("xx", "uk", "pl")).toBe("uk");
    expect(pickLang(undefined, undefined, "uk")).toBe("uk");
  });
  it("translates every landing text key used in index.html", () => {
    const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
    const keys = new Set<string>();
    for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) keys.add(m[1]);
    for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) m[1].split(";").forEach((p) => keys.add(p.split(":")[1]));
    for (const lang of ["uk", "en"] as const) {
      const missing = [...keys].filter((k) => !(k in LANDING[lang]!));
      expect(missing, lang).toEqual([]);
    }
  });
  it("has the same client and server keys in every language", () => {
    expect(Object.keys(CLIENT.uk).sort()).toEqual(Object.keys(CLIENT.pl).sort());
    expect(Object.keys(CLIENT.en).sort()).toEqual(Object.keys(CLIENT.pl).sort());
    expect(t("uk", "refTooLate")).toContain("14");
    expect(t("xx", "okTitle")).toBe(t("pl", "okTitle"));
  });
  it("prints the certificate in the order's language", () => {
    expect(formatDate("2027-06-15", "uk")).toBe("15 червня 2027");
    expect(formatDate("2027-06-15", "en")).toBe("15 June 2027");
    const svg = renderCertificate({ lang: "uk", recipient: "Оксана", place: "Львів", conditions: ["Słońce"], buyer: "Богдан" });
    expect(svg).toContain("СПЛАЧЕНО");
    expect(svg).toContain("Сонце");
    expect(svg).not.toContain("Słońce");
    expect(renderCertificate({ lang: "en", conditions: ["Bez deszczu"] })).toContain("No rain");
  });
  it("keeps Cyrillic names in the PDF", async () => {
    const pdf = await certificatePdf({ lang: "uk", recipient: "Їжачок Ґудзик", place: "Київ", dateLabel: "15 червня 2027", temp: "23–26°C", conditions: ["Słońce"], message: "Щоб було сонячно ☀️", buyer: "Богдан", certNo: "KPG-4F7Q2K" }, FONTS);
    expect(pdf.length).toBeGreaterThan(10_000);
  });
  it("answers refund requests in the requester's language", () => {
    const o = { status: "paid", refund_status: "none", weather_date: "2027-06-15", payment_id: "pi_1" } as Order;
    const r = decideRefund(o, "2027-07-15", 0, true, "en");
    expect(r.kind === "reject" && r.message).toContain("14 days");
  });
});

describe("greetings", () => {
  it("has ready-made greetings for every style and language, short enough for the certificate", () => {
    for (const lang of ["pl", "uk", "en"]) for (const k of STYLE_KEYS) {
      const list = (GREETINGS as Record<string, Record<string, string[]>>)[lang][k];
      expect(list.length, `${lang}/${k}`).toBeGreaterThanOrEqual(3);
      list.forEach((g: string) => expect(g.length).toBeLessThanOrEqual(160));
    }
  });
  it("cycles to the next greeting on repeated taps", () => {
    const first = GREETINGS.pl.poet[0];
    expect(pickGreeting("pl", "poet", first)).toBe(GREETINGS.pl.poet[1]);
  });
  it("cleans model output", () => {
    expect(cleanGreeting('"Niech słońce świeci tylko dla Ciebie."')).toBe("Niech słońce świeci tylko dla Ciebie.");
    expect(cleanGreeting("Here is a greeting:\nMay the sun follow you all day long.")).toBe("May the sun follow you all day long.");
    expect(cleanGreeting("ok")).toBe("");
    expect(cleanGreeting("Visit https://spam.example now for sunshine")).toBe("");
    expect(cleanGreeting("Słońce. ".repeat(40)).length).toBeLessThanOrEqual(180);
  });
  it("falls back to ready-made greetings without AI or when AI fails", async () => {
    const env = {} as never;
    const r = await makeGreeting(env, { style: "grandma", lang: "uk", recipient: "", place: "", current: "" }, true);
    expect(r.source).toBe("template");
    expect(GREETINGS.uk.grandma).toContain(r.text);
    const broken = { AI: { run: async () => { throw new Error("limit"); } } } as never;
    expect((await makeGreeting(broken, { style: "poet", lang: "en", recipient: "", place: "", current: "" }, true)).source).toBe("template");
    const ok = { AI: { run: async () => ({ response: "May every cloud take the day off for you, Anna." }) } } as never;
    expect(await makeGreeting(ok, { style: "poet", lang: "en", recipient: "Anna", place: "", current: "" }, true)).toEqual({ text: "May every cloud take the day off for you, Anna.", source: "ai" });
    expect((await makeGreeting(ok, { style: "poet", lang: "en", recipient: "", place: "", current: "" }, false)).source).toBe("template");
  });
  it("validates greeting requests", () => {
    expect(GreetingSchema.safeParse({ style: "poet", lang: "uk" }).success).toBe(true);
    expect(GreetingSchema.safeParse({ style: "hacker" }).success).toBe(false);
    expect(GreetingSchema.parse({ style: "poet", lang: "de" }).lang).toBe("pl");
  });
  it("stores language and style with the order", () => {
    const r = CheckoutSchema.parse({ ...valid, lang: "uk", style: "diplomat" });
    expect(r.lang).toBe("uk");
    expect(r.style).toBe("diplomat");
    expect(CheckoutSchema.parse({ ...valid, style: "nope" }).style).toBeUndefined();
  });
});
