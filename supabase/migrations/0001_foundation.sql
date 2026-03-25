-- =========================================================
-- Migration 0001: Foundation — Fase 1
-- Cria os tipos e tabelas base com RLS (Row Level Security)
-- =========================================================

-- ─── Tipos (Enums) ───────────────────────────────────────

CREATE TYPE tax_regime AS ENUM ('simples_nacional', 'lucro_presumido', 'lucro_real');
CREATE TYPE user_role AS ENUM ('admin', 'analyst', 'viewer');
CREATE TYPE connection_status AS ENUM ('active', 'expired', 'disconnected');
CREATE TYPE marketplace AS ENUM (
  'bling', 'mercadolivre', 'shopee', 'amazon', 'magalu',
  'shein', 'casas_bahia', 'webcontinental', 'madeiramadeira'
);

-- ─── Tenants ─────────────────────────────────────────────

CREATE TABLE tenants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  tax_regime      tax_regime DEFAULT 'simples_nacional',
  effective_tax_rate decimal(5,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Users ───────────────────────────────────────────────

CREATE TABLE users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role            user_role NOT NULL DEFAULT 'analyst',
  name            text NOT NULL,
  email           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_tenant_idx ON users(tenant_id);

-- ─── Marketplace Connections ─────────────────────────────

CREATE TABLE marketplace_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  marketplace     marketplace NOT NULL,
  access_token    text,
  refresh_token   text,
  expires_at      timestamptz,
  metadata        jsonb,
  status          connection_status NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, marketplace)
);

CREATE INDEX connections_tenant_idx ON marketplace_connections(tenant_id);

-- ─── Products ────────────────────────────────────────────

CREATE TABLE products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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

CREATE INDEX products_tenant_idx ON products(tenant_id);
CREATE INDEX products_bling_id_idx ON products(bling_id);
CREATE INDEX products_sku_idx ON products(sku);

-- ─── Product Listings ────────────────────────────────────

CREATE TABLE product_listings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  marketplace     marketplace NOT NULL,
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

CREATE INDEX listings_tenant_idx ON product_listings(tenant_id);
CREATE INDEX listings_product_idx ON product_listings(product_id);

-- ─── Orders ──────────────────────────────────────────────

CREATE TABLE orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bling_id        text,
  marketplace     marketplace,
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

CREATE INDEX orders_tenant_idx ON orders(tenant_id);
CREATE INDEX orders_date_idx ON orders(order_date);
CREATE INDEX orders_bling_idx ON orders(bling_id);

-- ─── Shared Dashboards ───────────────────────────────────

CREATE TABLE shared_dashboards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES users(id),
  name            text NOT NULL,
  token           text NOT NULL UNIQUE,
  password_hash   text,
  expires_at      timestamptz,
  visible_metrics jsonb NOT NULL,
  filters         jsonb,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX dashboards_tenant_idx ON shared_dashboards(tenant_id);

-- ─── Audit Logs ──────────────────────────────────────────

CREATE TABLE audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES users(id),
  action          text NOT NULL,
  entity_type     text,
  entity_id       text,
  details         jsonb,
  ip_address      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_tenant_idx ON audit_logs(tenant_id);

-- ─── Row Level Security ──────────────────────────────────

-- Ativa RLS em todas as tabelas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Função helper: retorna o tenant_id do usuário autenticado
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid()
$$;

-- Políticas: cada tabela so mostra dados do proprio tenant

CREATE POLICY "tenant_isolation" ON tenants
  FOR ALL USING (id = auth_tenant_id());

CREATE POLICY "tenant_isolation" ON users
  FOR ALL USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_isolation" ON marketplace_connections
  FOR ALL USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_isolation" ON products
  FOR ALL USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_isolation" ON product_listings
  FOR ALL USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_isolation" ON orders
  FOR ALL USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_isolation" ON shared_dashboards
  FOR ALL USING (tenant_id = auth_tenant_id());

-- shared_dashboards: permite leitura pública via token (para portal do cliente)
CREATE POLICY "public_token_read" ON shared_dashboards
  FOR SELECT USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );

CREATE POLICY "tenant_isolation" ON audit_logs
  FOR ALL USING (tenant_id = auth_tenant_id());

-- ─── Trigger: atualiza updated_at automaticamente ────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON marketplace_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON product_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
