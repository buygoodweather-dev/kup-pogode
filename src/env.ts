export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SITE_URL: string;
  EMAIL_FROM: string;
  SUPPORT_EMAIL: string;
  PRICE_VARIANTS: string;
  GUARANTEE_VARIANTS: string;
  AUTO_REFUNDS: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  ADMIN_EMAILS: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
}

export interface Order {
  id: number;
  order_id: string;
  cert_token: string;
  product: string;
  status: "pending" | "paid" | "failed" | "expired";
  created_at: string;
  paid_at: string | null;
  purchaser_name: string;
  purchaser_email: string;
  for_me: number;
  recipient_name: string;
  recipient_email: string | null;
  location: string;
  weather_date: string;
  temperature: string;
  weather_preferences: string;
  personal_message: string | null;
  price_variant: string;
  guarantee_variant: string;
  amount: number;
  currency: string;
  payment_provider: string;
  checkout_session_id: string | null;
  payment_id: string | null;
  email_status: string;
  recipient_email_status: string;
  email_resends: number;
  refund_status: "none" | "review" | "processing" | "completed" | "denied";
  refund_reason: string | null;
  refund_requested_at: string | null;
  refund_completed_at: string | null;
  refund_id: string | null;
  source: string | null;
  campaign: string | null;
  device: string | null;
}
