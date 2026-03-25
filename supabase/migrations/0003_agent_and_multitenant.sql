-- Migration 0003: Multi-tenant memberships + Agent tables expandidas

-- ─── Multi-tenant: usuário pode pertencer a vários tenants ────────────────────

CREATE TABLE IF NOT EXISTS marketplace.user_tenant_memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES marketplace.tenants(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin', 'analyst', 'viewer')),
  invited_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

-- Migrar dados existentes: quem já tem tenant_id na tabela users
INSERT INTO marketplace.user_tenant_memberships (user_id, tenant_id, role)
SELECT id, tenant_id, role
FROM marketplace.users
WHERE tenant_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO NOTHING;

ALTER TABLE marketplace.user_tenant_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_see_own" ON marketplace.user_tenant_memberships
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admins_manage_members" ON marketplace.user_tenant_memberships
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM marketplace.user_tenant_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

GRANT ALL ON marketplace.user_tenant_memberships TO authenticated, service_role;

-- ─── Agent Runs expandido ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace.agent_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES marketplace.tenants(id) ON DELETE CASCADE,
  agent_type   text NOT NULL, -- 'profit_watcher', 'buybox_monitor', 'price_analyzer', 'report_generator'
  status       text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  input        jsonb,
  output       jsonb,
  error        text,
  products_checked int DEFAULT 0,
  alerts_created   int DEFAULT 0,
  ai_tokens_used   int DEFAULT 0,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE marketplace.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_agent_runs" ON marketplace.agent_runs
  FOR ALL USING (tenant_id = marketplace.auth_tenant_id());
GRANT ALL ON marketplace.agent_runs TO authenticated, service_role;

-- ─── Agent Alerts expandido ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace.agent_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES marketplace.tenants(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES marketplace.products(id) ON DELETE CASCADE,
  run_id       uuid REFERENCES marketplace.agent_runs(id),
  alert_type   text NOT NULL, -- 'negative_margin', 'buybox_lost', 'buybox_gained', 'price_opportunity', 'catalog_drop', 'low_stock'
  severity     text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  marketplace  text,
  title        text NOT NULL,
  description  text,
  data         jsonb, -- dados extras: preço atual, preço sugerido, competidores, etc.
  is_read      boolean NOT NULL DEFAULT false,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE marketplace.agent_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_agent_alerts" ON marketplace.agent_alerts
  FOR ALL USING (tenant_id = marketplace.auth_tenant_id());
GRANT ALL ON marketplace.agent_alerts TO authenticated, service_role;

-- Index para leitura rápida de alertas não lidos
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_unread
  ON marketplace.agent_alerts(tenant_id, is_read, created_at DESC);

-- ─── AI Reports ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace.ai_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES marketplace.tenants(id) ON DELETE CASCADE,
  report_type  text NOT NULL DEFAULT 'executive', -- 'executive', 'pricing', 'buybox', 'performance'
  period_start date,
  period_end   date,
  content      text NOT NULL, -- markdown gerado pela IA
  model        text,
  tokens_used  int,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE marketplace.ai_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_ai_reports" ON marketplace.ai_reports
  FOR ALL USING (tenant_id = marketplace.auth_tenant_id());
GRANT ALL ON marketplace.ai_reports TO authenticated, service_role;

-- ─── Buybox Snapshots (histórico) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace.buybox_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES marketplace.tenants(id) ON DELETE CASCADE,
  product_id     uuid REFERENCES marketplace.products(id) ON DELETE CASCADE,
  marketplace    text NOT NULL,
  item_id        text, -- ID no marketplace
  is_winner      boolean,
  our_price      numeric(12,2),
  winner_price   numeric(12,2),
  competitor_prices jsonb, -- array de preços dos competidores
  catalog_position int,    -- posição no catálogo (se disponível)
  checked_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE marketplace.buybox_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_buybox" ON marketplace.buybox_snapshots
  FOR ALL USING (tenant_id = marketplace.auth_tenant_id());
GRANT ALL ON marketplace.buybox_snapshots TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_buybox_product_time
  ON marketplace.buybox_snapshots(product_id, checked_at DESC);
