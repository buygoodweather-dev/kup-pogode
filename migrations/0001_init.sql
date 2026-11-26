-- Orders: one row per purchase attempt. Becomes 'paid' only from a verified Stripe webhook.
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE,            -- KPG-XXXXXX, shown to people (also the certificate number)
  cert_token TEXT NOT NULL UNIQUE,          -- unguessable token for the certificate link
  product TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | paid | failed | expired
  created_at TEXT NOT NULL,
  paid_at TEXT,
  purchaser_name TEXT NOT NULL,
  purchaser_email TEXT NOT NULL,
  for_me INTEGER NOT NULL DEFAULT 0,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT,
  location TEXT NOT NULL,
  weather_date TEXT NOT NULL,               -- YYYY-MM-DD
  temperature TEXT NOT NULL,
  weather_preferences TEXT NOT NULL,        -- JSON array
  personal_message TEXT,
  price_variant TEXT NOT NULL,
  guarantee_variant TEXT NOT NULL,
  amount INTEGER NOT NULL,                  -- grosze
  currency TEXT NOT NULL DEFAULT 'pln',
  payment_provider TEXT NOT NULL DEFAULT 'stripe',
  checkout_session_id TEXT,
  payment_id TEXT,                          -- Stripe PaymentIntent id
  email_status TEXT NOT NULL DEFAULT 'none',          -- none | sent | failed | skipped
  recipient_email_status TEXT NOT NULL DEFAULT 'none',
  email_resends INTEGER NOT NULL DEFAULT 0,
  refund_status TEXT NOT NULL DEFAULT 'none',         -- none | review | processing | completed | denied
  refund_reason TEXT,
  refund_requested_at TEXT,
  refund_completed_at TEXT,
  refund_id TEXT,
  source TEXT, campaign TEXT, device TEXT
);
CREATE INDEX orders_status ON orders(status, created_at);
CREATE INDEX orders_email ON orders(purchaser_email);
CREATE INDEX orders_session ON orders(checkout_session_id);

-- Stripe event ids already handled (makes the webhook idempotent).
CREATE TABLE webhook_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TEXT NOT NULL
);

-- Cookie-less analytics: anonymous session id, no IP, no user agent string.
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  name TEXT NOT NULL,
  sid TEXT,
  order_id TEXT,
  path TEXT,
  source TEXT, campaign TEXT, device TEXT,
  price_variant TEXT, guarantee_variant TEXT
);
CREATE INDEX events_name_ts ON events(name, ts);
