import type { Env, Order } from "./env";
import { buyerEmail, recipientEmail, sendEmail } from "./email";
import { getOrder, logEvent } from "./db";
import { nowIso } from "./util";

/** Sends the certificate to the buyer (and the recipient, if given) and records the result. */
export async function deliverCertificate(env: Env, o: Order, resend = false): Promise<void> {
  const tag = resend ? `-r${o.email_resends + 1}` : "";
  const buyer = await sendEmail(env, { ...buyerEmail(env, o), idempotencyKey: `cert-${o.order_id}${tag}` });
  let recipient = o.recipient_email_status;
  if (o.recipient_email && (!resend || recipient !== "sent")) {
    recipient = await sendEmail(env, { ...recipientEmail(env, o), idempotencyKey: `cert-rcpt-${o.order_id}${tag}` });
  }
  await env.DB.prepare("UPDATE orders SET email_status=?, recipient_email_status=?, email_resends=email_resends+? WHERE order_id=?")
    .bind(buyer, recipient, resend ? 1 : 0, o.order_id).run();
}

/**
 * Called only from a verified webhook. The conditional UPDATE makes it safe to run twice:
 * only the call that flips pending -> paid sends the e-mail.
 */
export async function markPaid(env: Env, orderId: string, paymentId: string | null, amount: number | null, currency: string | null): Promise<"paid" | "already" | "mismatch" | "missing"> {
  const o = await getOrder(env, orderId);
  if (!o) return "missing";
  if (amount !== null && (amount !== o.amount || (currency ?? "").toLowerCase() !== o.currency)) {
    console.error(`amount mismatch for ${orderId}: got ${amount} ${currency}, expected ${o.amount} ${o.currency}`);
    return "mismatch";
  }
  const r = await env.DB.prepare("UPDATE orders SET status='paid', paid_at=?, payment_id=COALESCE(?, payment_id) WHERE order_id=? AND status IN ('pending','expired','failed')")
    .bind(nowIso(), paymentId, orderId).run();
  if (!r.meta.changes) return "already";
  await logEvent(env, { name: "payment_success", orderId, source: o.source, campaign: o.campaign, device: o.device, priceVariant: o.price_variant, guaranteeVariant: o.guarantee_variant });
  const paid = (await getOrder(env, orderId))!;
  await deliverCertificate(env, paid);
  return "paid";
}
