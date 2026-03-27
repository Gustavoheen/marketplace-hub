-- Tracking Total Express + NF number on orders
-- Migration 0006

ALTER TABLE marketplace.orders
  ADD COLUMN IF NOT EXISTS nf_number          text,
  ADD COLUMN IF NOT EXISTS nf_key             text,
  ADD COLUMN IF NOT EXISTS tracking_code      text,
  ADD COLUMN IF NOT EXISTS tracking_status    text,
  ADD COLUMN IF NOT EXISTS tracking_desc      text,
  ADD COLUMN IF NOT EXISTS tracking_date      timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_updated_at timestamptz;

-- Index for NF-based lookups
CREATE INDEX IF NOT EXISTS marketplace_orders_nf_number_idx
  ON marketplace.orders(tenant_id, nf_number);

-- Index for tracking queries
CREATE INDEX IF NOT EXISTS marketplace_orders_tracking_idx
  ON marketplace.orders(tenant_id, tracking_updated_at);
