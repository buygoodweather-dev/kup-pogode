import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { verifyStripeSignature, signStripePayload, stripeForm } from "../src/stripe";
import { CheckoutSchema, RefundSchema } from "../src/validation";
import { decideRefund } from "../src/refunds";
import { renderCertificate, formatDatePL, wrapText } from "../public/cert.js";
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
      { serif: f("CG-600.sub.ttf"), serifBold: f("CG-700.sub.ttf"), serifItalic: f("CG-500i.sub.ttf"), sans: f("MR-500.sub.ttf"), sansBold: f("MR-700.sub.ttf"), script: f("PS.sub.ttf") },
    );
    expect(pdf.length).toBeGreaterThan(10_000);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});

describe("ids", () => {
  it("makes readable order numbers", () => expect(newOrderId()).toMatch(/^KPG-[2-9A-HJ-NP-Z]{6}$/));
});
