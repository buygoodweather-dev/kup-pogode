import type { Order } from "./env";
import { addDays } from "./util";
import { t } from "./i18n";
import { formatDate } from "../public/cert.js";

export type RefundDecision =
  | { kind: "auto" }
  | { kind: "review"; why: string }
  | { kind: "reject"; message: string };

/**
 * Gwarancja Pogody rules (must match the Regulamin):
 *  - only paid orders, one request per order;
 *  - from the ordered weather date up to 14 days after it;
 *  - automatic if this e-mail got no other refund in the last 90 days, otherwise a person looks at it.
 */
export function decideRefund(order: Order, today: string, refundsForEmailLast90d: number, autoEnabled: boolean, lang = "pl"): RefundDecision {
  if (order.status !== "paid") return { kind: "reject", message: t(lang, "refUnpaid") };
  if (order.refund_status !== "none") return { kind: "reject", message: t(lang, order.refund_status === "review" || order.refund_status === "processing" ? "refDup" : "refDone") };
  if (today < order.weather_date) return { kind: "reject", message: t(lang, "refTooEarly", { date: formatDate(order.weather_date, lang) }) };
  if (today > addDays(order.weather_date, 14)) return { kind: "reject", message: t(lang, "refTooLate") };
  if (!order.payment_id) return { kind: "review", why: "brak identyfikatora płatności" };
  if (refundsForEmailLast90d > 0) return { kind: "review", why: "kolejny zwrot dla tego e-maila w ciągu 90 dni" };
  if (!autoEnabled) return { kind: "review", why: "automatyczne zwroty wyłączone" };
  return { kind: "auto" };
}
