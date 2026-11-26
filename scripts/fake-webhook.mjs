// Sends a signed fake Stripe event to a local worker: node scripts/fake-webhook.mjs <type> <order_id> [amount]
import { createHmac } from "node:crypto";
const [type, orderId, amount = "999"] = process.argv.slice(2);
const secret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_localtest";
const url = process.env.URL || "http://localhost:8787/api/stripe/webhook";
const event = { id: "evt_" + Math.random().toString(36).slice(2), type, data: { object: { metadata: { order_id: orderId }, client_reference_id: orderId, payment_status: "paid", payment_intent: "pi_test_" + orderId, amount_total: Number(amount), currency: "pln" } } };
const body = JSON.stringify(event);
const t = Math.floor(Date.now() / 1000);
const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
const send = () => fetch(url, { method: "POST", headers: { "Stripe-Signature": `t=${t},v1=${sig}`, "Content-Type": "application/json" }, body }).then(async (r) => console.log(r.status, await r.text()));
await send();
if (process.env.TWICE) await send(); // the same event again must be ignored
