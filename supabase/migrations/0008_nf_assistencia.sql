-- Coluna para armazenar a NF gerada na assistência (diferente da NF original do produto)
-- Extraída automaticamente das ocorrências do Bling via endpoint de backfill

ALTER TABLE marketplace.orders
  ADD COLUMN IF NOT EXISTS nf_assistencia text;

CREATE INDEX IF NOT EXISTS marketplace_orders_nf_assistencia_idx
  ON marketplace.orders(tenant_id, nf_assistencia)
  WHERE nf_assistencia IS NOT NULL;
