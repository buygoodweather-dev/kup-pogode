import { z } from "zod";
import { TEMPERATURES, CONDITIONS, MESSAGE_MAX } from "../public/cert.js";
import { addDays, todayWarsaw } from "./util";

/** Trim, drop control characters and collapse whitespace. */
const clean = (s: string) => s.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202E]/g, " ").replace(/\s+/g, " ").trim();
const text = (max: number) => z.string().transform(clean).pipe(z.string().max(max));
const email = z.string().transform((s) => s.trim().toLowerCase()).pipe(z.email().max(120));

const temperature = z.string().refine((t) => {
  if (TEMPERATURES.includes(t)) return true;
  const m = /^(-?\d{1,2})°C$/.exec(t);
  return !!m && Number(m[1]) >= -30 && Number(m[1]) <= 45;
}, "temperatura");

export const CheckoutSchema = z
  .object({
    forMe: z.boolean(),
    recipient: text(40),
    recipientEmail: z.union([z.literal(""), email]).optional().default(""),
    place: text(60).pipe(z.string().min(1, "miejsce")),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data"),
    temp: temperature,
    conditions: z.array(z.enum(CONDITIONS as [string, ...string[]])).min(1, "pogoda").max(4),
    message: text(MESSAGE_MAX).optional().default(""),
    buyer: text(40).pipe(z.string().min(1, "imię")),
    email,
    terms: z.literal(true),
    instant: z.literal(true),
    sid: z.string().max(40).optional(),
    source: z.string().max(80).optional(),
    campaign: z.string().max(80).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.forMe && !v.recipient) ctx.addIssue({ code: "custom", path: ["recipient"], message: "imię odbiorcy" });
    const today = todayWarsaw();
    // allow "yesterday" for people a few hours behind Poland; up to 3 years ahead
    if (v.date < addDays(today, -1) || v.date > addDays(today, 3 * 366)) ctx.addIssue({ code: "custom", path: ["date"], message: "data" });
    if (Number.isNaN(Date.parse(v.date + "T00:00:00Z"))) ctx.addIssue({ code: "custom", path: ["date"], message: "data" });
  })
  .transform((v) => ({ ...v, recipient: v.forMe ? v.buyer : v.recipient, recipientEmail: v.forMe ? "" : v.recipientEmail }));

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

export const RefundSchema = z.object({
  orderId: z.string().transform((s) => s.trim().toUpperCase().replace(/^KPG-?/, "KPG-")).pipe(z.string().regex(/^KPG-[2-9A-HJ-NP-Z]{6}$/)),
  email,
  reason: text(500).pipe(z.string().min(3)),
});

export const EVENT_NAMES = [
  "page_view", "hero_cta_click", "header_cta_click", "mid_cta_click", "sticky_cta_click", "occasion_click",
  "form_started", "form_completed", "checkout_started", "certificate_viewed", "certificate_downloaded",
  "certificate_shared", "refund_page_view",
] as const;
export const EventSchema = z.object({
  name: z.enum(EVENT_NAMES),
  sid: z.string().max(40).optional(),
  path: z.string().max(200).optional(),
  source: z.string().max(80).optional(),
  campaign: z.string().max(80).optional(),
  orderId: z.string().max(12).optional(),
});
