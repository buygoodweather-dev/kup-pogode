-- language the order was placed in (certificate, PDF and e-mails use it) and the chosen greeting style
ALTER TABLE orders ADD COLUMN lang TEXT NOT NULL DEFAULT 'pl';
ALTER TABLE orders ADD COLUMN greeting_style TEXT;
