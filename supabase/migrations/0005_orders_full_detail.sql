-- Full order detail columns for Bling sync and profit calculation
-- Migration 0005

ALTER TABLE marketplace.orders
  ADD COLUMN IF NOT EXISTS order_number      text,
  ADD COLUMN IF NOT EXISTS customer_state    text,
  ADD COLUMN IF NOT EXISTS shipping_carrier  text,
  ADD COLUMN IF NOT EXISTS shipping_cost     decimal(10,2),
  ADD COLUMN IF NOT EXISTS discount_total    decimal(10,2),
  ADD COLUMN IF NOT EXISTS items_detail      jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS commission_rate   decimal(5,2),
  ADD COLUMN IF NOT EXISTS commission_amount decimal(10,2),
  ADD COLUMN IF NOT EXISTS net_profit        decimal(10,2);

-- Pricing configuration columns for products
ALTER TABLE marketplace.products
  ADD COLUMN IF NOT EXISTS pricing_mode   text DEFAULT 'markup',
  ADD COLUMN IF NOT EXISTS markup_pct     decimal(5,2),
  ADD COLUMN IF NOT EXISTS fixed_profit   decimal(10,2),
  ADD COLUMN IF NOT EXISTS extra_cost     decimal(10,2);

-- Index for order_number lookups
CREATE INDEX IF NOT EXISTS marketplace_orders_order_number_idx
  ON marketplace.orders(tenant_id, order_number);

-- Index for profit calculations
CREATE INDEX IF NOT EXISTS marketplace_orders_profit_idx
  ON marketplace.orders(tenant_id, net_profit);
