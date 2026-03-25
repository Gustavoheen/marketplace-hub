-- Extend orders table with additional columns for sync + dashboard BI
-- Existing columns: bling_id, total_amount, order_date, status, customer_name, etc.

ALTER TABLE marketplace.orders
  ADD COLUMN IF NOT EXISTS source      text DEFAULT 'bling',
  ADD COLUMN IF NOT EXISTS items_count int DEFAULT 0;

-- Index for dashboard date queries
CREATE INDEX IF NOT EXISTS marketplace_orders_date_status_idx
  ON marketplace.orders(tenant_id, order_date, status);

-- Index for marketplace filter
CREATE INDEX IF NOT EXISTS marketplace_orders_marketplace_idx
  ON marketplace.orders(tenant_id, marketplace);
