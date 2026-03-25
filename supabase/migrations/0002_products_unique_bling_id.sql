-- Migration 0002: Adicionar constraint UNIQUE(tenant_id, bling_id) em products
-- Necessário para o ON CONFLICT usado no upsert de produtos do Bling

ALTER TABLE marketplace.products
  ADD CONSTRAINT products_tenant_bling_id_unique UNIQUE (tenant_id, bling_id);
