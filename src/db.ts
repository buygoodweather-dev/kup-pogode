import type { Env, Order } from "./env";
import { nowIso } from "./util";

export const getOrder = (env: Env, orderId: string) => env.DB.prepare("SELECT * FROM orders WHERE order_id = ?").bind(orderId).first<Order>();
export const getOrderByToken = (env: Env, token: string) => env.DB.prepare("SELECT * FROM orders WHERE cert_token = ?").bind(token).first<Order>();

export async function logEvent(env: Env, e: { name: string; sid?: string | null; orderId?: string | null; path?: string | null; source?: string | null; campaign?: string | null; device?: string | null; priceVariant?: string | null; guaranteeVariant?: string | null }) {
  await env.DB.prepare("INSERT INTO events (ts, name, sid, order_id, path, source, campaign, device, price_variant, guarantee_variant) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(nowIso(), e.name, e.sid ?? null, e.orderId ?? null, e.path ?? null, e.source ?? null, e.campaign ?? null, e.device ?? null, e.priceVariant ?? null, e.guaranteeVariant ?? null)
    .run();
}

/** Returns true only the first time an event id is seen. */
export async function firstTimeEvent(env: Env, id: string, type: string): Promise<boolean> {
  const r = await env.DB.prepare("INSERT OR IGNORE INTO webhook_events (event_id, type, received_at) VALUES (?,?,?)").bind(id, type, nowIso()).run();
  return (r.meta.changes ?? 0) > 0;
}
