-- =========================================================
-- Migration 0001: Foundation — Fase 1
-- Schema: marketplace (isolado do schema public do Fogão a Lenha)
-- =========================================================

-- ─── Criar schema marketplace ────────────────────────────

CREATE SCHEMA IF NOT EXISTS marketplace;

-- ─── Tipos (Enums) ───────────────────────────────────────

CREATE TYPE marketplace.tax_regime AS ENUM ('simples_nacional', 'lucro_presumido', 'lucro_real');
CREATE TYPE marketplace.user_role AS ENUM ('admin', 'analyst', 'viewer');
CREATE TYPE marketplace.connection_status AS ENUM ('active', 'expired', 'disconnected');
CREATE TYPE marketplace.marketplace_name AS ENUM (
  'bling', 'mercadolivre', 'shopee', 'amazon', 'magalu',
  'shein', 'casas_bahia', 'webcontinental', 'madeiramadeira'
);

-- ─── Tenants ─────────────────────────────────────────────

CREATE TABLE marketplace.tenants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  tax_regime      marketplace.tax_regime DEFAULT 'simples_nacional',
  effective_tax_rate decimal(5,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Users ───────────────────────────────────────────────

CREATE TABLE marketplace.users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES marketplace.tenants(id) ON DELETE CASCADE,
  role            marketplace.user_role NOT NULL DEFAULT 'analyst',
  name            text NOT NULL,
  email           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketplace_users_tenant_idx ON marketplace.users(tenant_id);

-- ─── Marketplace Connections ─────────────────────────────

CREATE TABLE marketplace.marketplace_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES marketplace.tenants(id) ON DELETE CASCADE,
  marketplace     marketplace.marketplace_name NOT NULL,
  access_token    text,
  refresh_token   text,
  expires_at      timestamptz,
  metadata        jsonb,
  status          marketplace.connection_status NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, marketplace)
);

CREATE INDEX marketplace_connections_tenant_idx ON marketplace.marketplace_connections(tenant_id);

-- ─── Products ────────────────────────────────────────────

CREATE TABLE marketplace.products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES marketplace.tenants(id) ON DELETE CASCADE,
  bling_id        text,
  sku             text,
  name            text NOT NULL,
  description     text,
  short_description text,
  cost_price      decimal(12,2),
  sale_price      decimal(12,2),
  gtin            text,
  ncm             text,
  brand           text,
  weight_kg       decimal(8,3),
  width_cm        decimal(8,2),
  height_cm       decimal(8,2),
  depth_cm        decimal(8,2),
  images          jsonb DEFAULT '[]'::jsonb,
  stock_total     integer DEFAULT 0,
  category_bling  text,
  status          text DEFAULT 'active',
  raw_data        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  synced_at       timestamptz
);

CREATE INDEX marketplace_products_tenant_idx ON marketplace.products(tenant_id);
CREATE INDEX marketplace_products_bling_id_idx ON marketplace.products(bling_id);
CREATE INDEX marketplace_products_sku_idx ON marketplace.products(sku);

-- ─── Product Listings ────────────────────────────────────

CREATE TABLE marketplace.product_listings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES marketplace.tenants(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES marketplace.products(id) ON DELETE CASCADE,
  marketplace     marketplace.marketplace_name NOT NULL,
  external_id     text,
  category_id     text,
  listing_url     text,
  price           decimal(12,2),
  status          text DEFAULT 'active',
  attributes      jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, marketplace, external_id)
);

CREATE INDEX marketplace_listings_tenant_idx ON marketplace.product_listings(tenant_id);
CREATE INDEX marketplace_listings_product_idx ON marketplace.product_listings(product_id);

-- ─── Orders ──────────────────────────────────────────────

CREATE TABLE marketplace.orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES marketplace.tenants(id) ON DELETE CASCADE,
  bling_id        text,
  marketplace     marketplace.marketplace_name,
  external_order_id text,
  customer_name   text,
  customer_state  text,
  total_amount    decimal(12,2),
  shipping_cost   decimal(12,2),
  marketplace_fee decimal(12,2),
  status          text,
  order_date      timestamptz,
  shipped_date    timestamptz,
  delivered_date  timestamptz,
  items           jsonb,
  raw_data        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  synced_at       timestamptz
);

CREATE INDEX marketplace_orders_tenant_idx ON marketplace.orders(tenant_id);
CREATE INDEX marketplace_orders_date_idx ON marketplace.orders(order_date);
CREATE INDEX marketplace_orders_bling_idx ON marketplace.orders(bling_id);

-- ─── Shared Dashboards ───────────────────────────────────

CREATE TABLE marketplace.shared_dashboards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES marketplace.tenants(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES marketplace.users(id),
  name            text NOT NULL,
  token           text NOT NULL UNIQUE,
  password_hash   text,
  expires_at      timestamptz,
  visible_metrics jsonb NOT NULL,
  filters         jsonb,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketplace_dashboards_tenant_idx ON marketplace.shared_dashboards(tenant_id);

-- ─── Audit Logs ──────────────────────────────────────────

CREATE TABLE marketplace.audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES marketplace.tenants(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES marketplace.users(id),
  action          text NOT NULL,
  entity_type     text,
  entity_id       text,
  details         jsonb,
  ip_address      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketplace_audit_tenant_idx ON marketplace.audit_logs(tenant_id);

-- ─── Row Level Security ──────────────────────────────────

ALTER TABLE marketplace.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace.marketplace_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace.product_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace.shared_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace.audit_logs ENABLE ROW LEVEL SECURITY;

-- Função helper: retorna o tenant_id do usuário autenticado
CREATE OR REPLACE FUNCTION marketplace.auth_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT tenant_id FROM marketplace.users WHERE id = auth.uid()
$$;

-- Políticas RLS
CREATE POLICY "tenant_isolation" ON marketplace.tenants
  FOR ALL USING (id = marketplace.auth_tenant_id());

CREATE POLICY "tenant_isolation" ON marketplace.users
  FOR ALL USING (tenant_id = marketplace.auth_tenant_id());

CREATE POLICY "tenant_isolation" ON marketplace.marketplace_connections
  FOR ALL USING (tenant_id = marketplace.auth_tenant_id());

CREATE POLICY "tenant_isolation" ON marketplace.products
  FOR ALL USING (tenant_id = marketplace.auth_tenant_id());

CREATE POLICY "tenant_isolation" ON marketplace.product_listings
  FOR ALL USING (tenant_id = marketplace.auth_tenant_id());

CREATE POLICY "tenant_isolation" ON marketplace.orders
  FOR ALL USING (tenant_id = marketplace.auth_tenant_id());

CREATE POLICY "tenant_isolation" ON marketplace.shared_dashboards
  FOR ALL USING (tenant_id = marketplace.auth_tenant_id());

CREATE POLICY "public_token_read" ON marketplace.shared_dashboards
  FOR SELECT USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );

CREATE POLICY "tenant_isolation" ON marketplace.audit_logs
  FOR ALL USING (tenant_id = marketplace.auth_tenant_id());

-- ─── Trigger: updated_at automático ─────────────────────

CREATE OR REPLACE FUNCTION marketplace.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketplace.tenants
  FOR EACH ROW EXECUTE FUNCTION marketplace.update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketplace.marketplace_connections
  FOR EACH ROW EXECUTE FUNCTION marketplace.update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketplace.products
  FOR EACH ROW EXECUTE FUNCTION marketplace.update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketplace.product_listings
  FOR EACH ROW EXECUTE FUNCTION marketplace.update_updated_at();

-- ─── Expor schema marketplace para o anon/service role ───

GRANT USAGE ON SCHEMA marketplace TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA marketplace TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA marketplace TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA marketplace
  GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA marketplace
  GRANT ALL ON SEQUENCES TO authenticated, service_role;
