// ─── Tabelas de comissão e taxas por marketplace ───────────────────────────
// Fontes: documentações oficiais de cada marketplace (2025)
// Valores aproximados — verifique sempre a tabela oficial do marketplace

export type FeeCategory = {
  label: string
  commission: number  // % sobre preço de venda
  fixedFee?: number   // R$ fixo por transação (ex: ML cobra quando < R$79)
  fixedFeeThreshold?: number // abaixo desse preço cobra a taxa fixa
}

export type MarketplaceFeeTable = {
  name: string
  slug: string
  listingTypes?: Record<string, { label: string; commissionMultiplier: number }>
  categories: Record<string, FeeCategory>
  defaultCategory: string
  notes?: string
}

// ─── Mercado Livre ───────────────────────────────────────────────────────────
// Fonte: https://www.mercadolivre.com.br/ajuda/custos-de-vender_1735
// Tipo de anúncio muda a % (Grátis=0, Clássico=~11-13%, Premium=~14-18%)
export const MERCADOLIVRE_FEES: MarketplaceFeeTable = {
  name: 'Mercado Livre',
  slug: 'mercadolivre',
  listingTypes: {
    free:          { label: 'Grátis',    commissionMultiplier: 0 },
    gold_special:  { label: 'Clássico',  commissionMultiplier: 1 },
    gold_premium:  { label: 'Premium',   commissionMultiplier: 1.35 },
  },
  defaultCategory: 'geral',
  notes: 'Taxa fixa de R$5,00 para itens vendidos por menos de R$79 (Clássico/Premium)',
  categories: {
    geral:             { label: 'Geral',                  commission: 11, fixedFee: 5, fixedFeeThreshold: 79 },
    eletronicos:       { label: 'Eletrônicos',            commission: 11, fixedFee: 5, fixedFeeThreshold: 79 },
    informatica:       { label: 'Informática',            commission: 11, fixedFee: 5, fixedFeeThreshold: 79 },
    celulares:         { label: 'Celulares',              commission: 11, fixedFee: 5, fixedFeeThreshold: 79 },
    televisores:       { label: 'TVs e Vídeo',            commission: 11, fixedFee: 5, fixedFeeThreshold: 79 },
    casa:              { label: 'Casa e Decoração',       commission: 13, fixedFee: 5, fixedFeeThreshold: 79 },
    moveis:            { label: 'Móveis',                 commission: 13, fixedFee: 5, fixedFeeThreshold: 79 },
    esportes:          { label: 'Esportes',               commission: 14, fixedFee: 5, fixedFeeThreshold: 79 },
    moda:              { label: 'Moda e Beleza',          commission: 16, fixedFee: 5, fixedFeeThreshold: 79 },
    autoparts:         { label: 'Autopeças',              commission: 13, fixedFee: 5, fixedFeeThreshold: 79 },
    bebes:             { label: 'Bebês',                  commission: 14, fixedFee: 5, fixedFeeThreshold: 79 },
    ferramentas:       { label: 'Ferramentas',            commission: 14, fixedFee: 5, fixedFeeThreshold: 79 },
    livros:            { label: 'Livros e Revistas',      commission: 14, fixedFee: 5, fixedFeeThreshold: 79 },
    brinquedos:        { label: 'Brinquedos',             commission: 16, fixedFee: 5, fixedFeeThreshold: 79 },
    animais:           { label: 'Animais',                commission: 14, fixedFee: 5, fixedFeeThreshold: 79 },
  },
}

// ─── Shopee ──────────────────────────────────────────────────────────────────
// Fonte: https://seller.shopee.com.br/edu/article/sobre-taxas-shopee
export const SHOPEE_FEES: MarketplaceFeeTable = {
  name: 'Shopee',
  slug: 'shopee',
  defaultCategory: 'geral',
  notes: 'Taxa de transação de 2% sobre o valor total. Frete subsidiado pela Shopee para envios via Shopee Envios.',
  categories: {
    geral:         { label: 'Geral',              commission: 14 },
    eletronicos:   { label: 'Eletrônicos',        commission: 14 },
    celulares:     { label: 'Celulares',          commission: 14 },
    moda:          { label: 'Moda',               commission: 20 },
    casa:          { label: 'Casa e Decoração',   commission: 14 },
    esportes:      { label: 'Esportes',           commission: 14 },
    beleza:        { label: 'Beleza e Saúde',     commission: 14 },
    brinquedos:    { label: 'Brinquedos',         commission: 14 },
    alimentos:     { label: 'Alimentos',          commission: 12 },
    autoparts:     { label: 'Autopeças',          commission: 14 },
  },
}

// ─── Amazon Brasil ───────────────────────────────────────────────────────────
// Fonte: https://sellercentral.amazon.com.br/gp/help/G200336920
export const AMAZON_FEES: MarketplaceFeeTable = {
  name: 'Amazon Brasil',
  slug: 'amazon',
  defaultCategory: 'geral',
  notes: 'Taxa de venda varia por categoria. FBA tem taxas adicionais de armazenagem e fulfillment.',
  categories: {
    geral:          { label: 'Geral',               commission: 15 },
    eletronicos:    { label: 'Eletrônicos',          commission: 8  },
    informatica:    { label: 'Informática',          commission: 8  },
    celulares:      { label: 'Celulares',            commission: 8  },
    casa:           { label: 'Casa e Cozinha',       commission: 15 },
    moveis:         { label: 'Móveis',               commission: 15 },
    esportes:       { label: 'Esportes',             commission: 15 },
    moda:           { label: 'Moda',                 commission: 17 },
    livros:         { label: 'Livros',               commission: 15 },
    brinquedos:     { label: 'Brinquedos',           commission: 13 },
    autoparts:      { label: 'Autopeças',            commission: 12 },
    beleza:         { label: 'Beleza e Saúde',       commission: 15 },
    alimentos:      { label: 'Alimentos',            commission: 15 },
    ferramentas:    { label: 'Ferramentas',          commission: 12 },
    instrumentos:   { label: 'Instrumentos Musicais',commission: 15 },
    pet:            { label: 'Pet Shop',             commission: 15 },
  },
}

// ─── Magalu ──────────────────────────────────────────────────────────────────
export const MAGALU_FEES: MarketplaceFeeTable = {
  name: 'Magalu',
  slug: 'magalu',
  defaultCategory: 'geral',
  notes: 'Comissões variam por categoria e nível do parceiro.',
  categories: {
    geral:         { label: 'Geral',              commission: 16 },
    eletronicos:   { label: 'Eletrônicos',        commission: 12 },
    informatica:   { label: 'Informática',        commission: 12 },
    celulares:     { label: 'Celulares',          commission: 12 },
    televisores:   { label: 'TVs',                commission: 12 },
    casa:          { label: 'Casa e Decoração',   commission: 16 },
    moveis:        { label: 'Móveis',             commission: 16 },
    esportes:      { label: 'Esportes',           commission: 16 },
    moda:          { label: 'Moda',               commission: 20 },
    beleza:        { label: 'Beleza',             commission: 18 },
    autoparts:     { label: 'Autopeças',          commission: 14 },
    brinquedos:    { label: 'Brinquedos',         commission: 18 },
    ferramentas:   { label: 'Ferramentas',        commission: 14 },
  },
}

// ─── Americanas Marketplace ───────────────────────────────────────────────────
export const AMERICANAS_FEES: MarketplaceFeeTable = {
  name: 'Americanas',
  slug: 'americanas',
  defaultCategory: 'geral',
  categories: {
    geral:         { label: 'Geral',              commission: 16 },
    eletronicos:   { label: 'Eletrônicos',        commission: 12 },
    informatica:   { label: 'Informática',        commission: 12 },
    celulares:     { label: 'Celulares',          commission: 12 },
    casa:          { label: 'Casa e Decoração',   commission: 16 },
    moveis:        { label: 'Móveis',             commission: 16 },
    esportes:      { label: 'Esportes',           commission: 16 },
    moda:          { label: 'Moda',               commission: 20 },
    beleza:        { label: 'Beleza',             commission: 18 },
    brinquedos:    { label: 'Brinquedos',         commission: 18 },
    livros:        { label: 'Livros',             commission: 15 },
    autoparts:     { label: 'Autopeças',          commission: 14 },
  },
}

// ─── Casas Bahia ─────────────────────────────────────────────────────────────
export const CASASBAHIA_FEES: MarketplaceFeeTable = {
  name: 'Casas Bahia',
  slug: 'casas_bahia',
  defaultCategory: 'geral',
  categories: {
    geral:         { label: 'Geral',              commission: 16 },
    eletronicos:   { label: 'Eletrônicos',        commission: 12 },
    informatica:   { label: 'Informática',        commission: 12 },
    celulares:     { label: 'Celulares',          commission: 12 },
    casa:          { label: 'Casa e Decoração',   commission: 16 },
    moveis:        { label: 'Móveis',             commission: 16 },
    esportes:      { label: 'Esportes',           commission: 16 },
    moda:          { label: 'Moda',               commission: 18 },
    beleza:        { label: 'Beleza',             commission: 16 },
    brinquedos:    { label: 'Brinquedos',         commission: 18 },
  },
}

// ─── Carrefour ────────────────────────────────────────────────────────────────
export const CARREFOUR_FEES: MarketplaceFeeTable = {
  name: 'Carrefour',
  slug: 'carrefour',
  defaultCategory: 'geral',
  categories: {
    geral:         { label: 'Geral',              commission: 16 },
    alimentos:     { label: 'Alimentos',          commission: 12 },
    eletronicos:   { label: 'Eletrônicos',        commission: 12 },
    casa:          { label: 'Casa e Decoração',   commission: 16 },
    esportes:      { label: 'Esportes',           commission: 16 },
    beleza:        { label: 'Beleza e Higiene',   commission: 14 },
    pet:           { label: 'Pet',                commission: 14 },
  },
}

// ─── Shein ────────────────────────────────────────────────────────────────────
export const SHEIN_FEES: MarketplaceFeeTable = {
  name: 'Shein',
  slug: 'shein',
  defaultCategory: 'moda',
  notes: 'Marketplace focado em moda. Frete gratuito para o comprador em pedidos acima de R$99.',
  categories: {
    moda:          { label: 'Moda e Acessórios',  commission: 20 },
    casa:          { label: 'Casa',               commission: 18 },
    beleza:        { label: 'Beleza',             commission: 18 },
    esportes:      { label: 'Esportes',           commission: 18 },
  },
}

// ─── WebContinental ───────────────────────────────────────────────────────────
export const WEBCONTINENTAL_FEES: MarketplaceFeeTable = {
  name: 'WebContinental',
  slug: 'webcontinental',
  defaultCategory: 'geral',
  categories: {
    geral:         { label: 'Geral',              commission: 15 },
    eletronicos:   { label: 'Eletrônicos',        commission: 12 },
    informatica:   { label: 'Informática',        commission: 12 },
    casa:          { label: 'Casa',               commission: 15 },
    esportes:      { label: 'Esportes',           commission: 15 },
  },
}

// ─── MadeiraMadeira ───────────────────────────────────────────────────────────
export const MADEIRAMADEIRA_FEES: MarketplaceFeeTable = {
  name: 'MadeiraMadeira',
  slug: 'madeiramadeira',
  defaultCategory: 'moveis',
  categories: {
    moveis:        { label: 'Móveis',             commission: 16 },
    decoracao:     { label: 'Decoração',          commission: 16 },
    ferramentas:   { label: 'Ferramentas',        commission: 16 },
    casa:          { label: 'Casa',               commission: 16 },
    iluminacao:    { label: 'Iluminação',         commission: 16 },
  },
}

// ─── Kabum ────────────────────────────────────────────────────────────────────
export const KABUM_FEES: MarketplaceFeeTable = {
  name: 'Kabum',
  slug: 'kabum',
  defaultCategory: 'eletronicos',
  notes: 'Foco em tecnologia, games e hardware.',
  categories: {
    eletronicos:   { label: 'Eletrônicos',        commission: 12 },
    informatica:   { label: 'Informática',        commission: 12 },
    perifericos:   { label: 'Periféricos',        commission: 12 },
    games:         { label: 'Games',              commission: 12 },
    componentes:   { label: 'Componentes PC',     commission: 10 },
    celulares:     { label: 'Celulares',          commission: 10 },
    tvs:           { label: 'TVs',                commission: 12 },
    cameras:       { label: 'Câmeras',            commission: 12 },
  },
}

// ─── Netshoes / Centauro ──────────────────────────────────────────────────────
export const NETSHOES_FEES: MarketplaceFeeTable = {
  name: 'Netshoes',
  slug: 'netshoes',
  defaultCategory: 'esportes',
  categories: {
    esportes:      { label: 'Esportes',           commission: 18 },
    calcados:      { label: 'Calçados',           commission: 18 },
    moda:          { label: 'Moda Esportiva',     commission: 18 },
    acessorios:    { label: 'Acessórios',         commission: 18 },
    fitness:       { label: 'Fitness',            commission: 18 },
  },
}

// ─── Índice geral ─────────────────────────────────────────────────────────────

export const ALL_FEE_TABLES: Record<string, MarketplaceFeeTable> = {
  mercadolivre:  MERCADOLIVRE_FEES,
  shopee:        SHOPEE_FEES,
  amazon:        AMAZON_FEES,
  magalu:        MAGALU_FEES,
  americanas:    AMERICANAS_FEES,
  casas_bahia:   CASASBAHIA_FEES,
  carrefour:     CARREFOUR_FEES,
  shein:         SHEIN_FEES,
  webcontinental: WEBCONTINENTAL_FEES,
  madeiramadeira: MADEIRAMADEIRA_FEES,
  kabum:         KABUM_FEES,
  netshoes:      NETSHOES_FEES,
}
