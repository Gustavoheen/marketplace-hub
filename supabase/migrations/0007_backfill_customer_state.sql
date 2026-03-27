-- Recupera customer_state a partir do raw_data para pedidos onde o campo está nulo
-- Fontes: enderecoEntrega.uf → contato.endereco.uf
UPDATE marketplace.orders
SET customer_state = UPPER(COALESCE(
  raw_data->'enderecoEntrega'->>'uf',
  raw_data->'contato'->'endereco'->>'uf'
))
WHERE customer_state IS NULL
  AND raw_data IS NOT NULL
  AND COALESCE(
    raw_data->'enderecoEntrega'->>'uf',
    raw_data->'contato'->'endereco'->>'uf'
  ) IS NOT NULL;
