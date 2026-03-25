// ─── Marketplaces ─────────────────────────────────────────────────────────────

export type Marketplace =
  | 'bling'           // ERP
  | 'tiny'            // ERP
  | 'omie'            // ERP
  | 'olist'           // ERP
  | 'nuvemshop'       // ERP/Plataforma
  | 'vtex'            // ERP/Plataforma
  | 'tray'            // ERP/Plataforma
  | 'loja_integrada'  // ERP/Plataforma
  | 'mercadolivre'
  | 'shopee'
  | 'amazon'
  | 'magalu'
  | 'americanas'
  | 'shoptime'
  | 'submarino'
  | 'casas_bahia'
  | 'ponto'
  | 'extra'
  | 'carrefour'
  | 'shein'
  | 'netshoes'
  | 'centauro'
  | 'webcontinental'
  | 'madeiramadeira'
  | 'kabum'
  | 'leroy_merlin'
  | 'havan'
  | 'pichau'
  | 'olx'

export type FreightGateway =
  | 'melhor_envio'
  | 'frenet'
  | 'intelipost'
  | 'jadlog'
  | 'total_express'
  | 'loggi'
  | 'correios'
  | 'azul_cargo'
  | 'sequoia'
  | 'shopee_envios'
  | 'ml_envios'

export type ConnectionStatus = 'active' | 'expired' | 'disconnected' | 'error'

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  // ERPs
  bling:           'Bling ERP',
  tiny:            'Tiny ERP',
  omie:            'Omie',
  olist:           'Olist',
  nuvemshop:       'NuvemShop',
  vtex:            'VTEX',
  tray:            'Tray Commerce',
  loja_integrada:  'Loja Integrada',
  // Marketplaces
  mercadolivre:    'Mercado Livre',
  shopee:          'Shopee',
  amazon:          'Amazon Brasil',
  magalu:          'Magalu',
  americanas:      'Americanas',
  shoptime:        'Shoptime',
  submarino:       'Submarino',
  casas_bahia:     'Casas Bahia',
  ponto:           'Ponto',
  extra:           'Extra',
  carrefour:       'Carrefour',
  shein:           'Shein',
  netshoes:        'Netshoes',
  centauro:        'Centauro',
  webcontinental:  'WebContinental',
  madeiramadeira:  'MadeiraMadeira',
  kabum:           'Kabum',
  leroy_merlin:    'Leroy Merlin',
  havan:           'Havan',
  pichau:          'Pichau',
  olx:             'OLX',
}

export const FREIGHT_GATEWAY_LABELS: Record<FreightGateway, string> = {
  melhor_envio:    'Melhor Envio',
  frenet:          'Frenet',
  intelipost:      'Intelipost',
  jadlog:          'Jadlog',
  total_express:   'Total Express',
  loggi:           'Loggi',
  correios:        'Correios',
  azul_cargo:      'Azul Cargo',
  sequoia:         'Sequoia',
  shopee_envios:   'Shopee Envios',
  ml_envios:       'MELI Envios',
}

// ─── Tenant ────────────────────────────────────────────────────────────────────

export type Tenant = {
  id: string
  name: string
  slug: string
  plan: 'free' | 'pro' | 'enterprise'
  createdAt: string
}

export type TenantUser = {
  id: string
  tenantId: string
  userId: string
  role: 'admin' | 'analyst' | 'viewer'
  email: string
  name: string | null
}

// ─── Agent / Alertas ──────────────────────────────────────────────────────────

export type AlertType =
  | 'negative_margin'
  | 'buybox_lost'
  | 'buybox_gained'
  | 'price_opportunity'
  | 'catalog_drop'
  | 'low_stock'

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

export type AgentAlert = {
  id: string
  productId?: string
  runId?: string
  alertType: AlertType
  severity: AlertSeverity
  marketplace?: string
  title: string
  description?: string
  data?: Record<string, unknown>
  isRead: boolean
  createdAt: string
}
