import type { Env, Order } from "./env";
import { timingSafeEqual } from "./util";

/** Encode nested objects the way Stripe's form API expects: a[b][0][c]=v */
export function stripeForm(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? stripeForm(item as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") stripeForm(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe<T>(env: Env, path: string, body: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: stripeForm(body),
  });
  const json = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) throw new Error(`Stripe ${path}: ${json.error?.message ?? res.status}`);
  return json;
}

export interface CheckoutSession { id: string; url: string }

export function createCheckoutSession(env: Env, order: Order, productName: string): Promise<CheckoutSession> {
  const site = env.SITE_URL.replace(/\/$/, "");
  return stripe<CheckoutSession>(
    env,
    "checkout/sessions",
    {
      mode: "payment",
      locale: "pl",
      // payment methods (BLIK, Przelewy24, cards, Apple Pay, Google Pay) are switched on in the Stripe dashboard
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "pln",
            unit_amount: order.amount, // always the server's price, never the browser's
            product_data: { name: productName, description: `${order.location}, ${order.weather_date}` },
          },
        },
      ],
      customer_email: order.purchaser_email,
      client_reference_id: order.order_id,
      metadata: { order_id: order.order_id },
      payment_intent_data: { metadata: { order_id: order.order_id }, description: `${productName} ${order.order_id}` },
      success_url: `${site}/sukces?o=${order.order_id}&s={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/?anulowano=1#zamow`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
    },
    `checkout-${order.order_id}`,
  );
}

export function createRefund(env: Env, order: Order): Promise<{ id: string; status: string }> {
  return stripe(env, "refunds", { payment_intent: order.payment_id, reason: "requested_by_customer", metadata: { order_id: order.order_id } }, `refund-${order.order_id}`);
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verifies the Stripe-Signature header (t=...,v1=...) with a 5 minute tolerance. */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.split("=") as [string, string]);
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length || !/^\d+$/.test(t)) return false;
  if (Math.abs(nowSec - Number(t)) > toleranceSec) return false;
  const expected = await hmacHex(secret, `${t}.${payload}`);
  return sigs.some((s) => timingSafeEqual(s, expected));
}

/** For tests and local runs: builds a valid header for a payload. */
export async function signStripePayload(payload: string, secret: string, t = Math.floor(Date.now() / 1000)): Promise<string> {
  return `t=${t},v1=${await hmacHex(secret, `${t}.${payload}`)}`;
}
