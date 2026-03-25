export type TaxRegime = 'simples_nacional' | 'lucro_presumido' | 'lucro_real'
export type UserRole = 'admin' | 'analyst' | 'viewer'
export type Marketplace =
  | 'bling'
  | 'mercadolivre'
  | 'shopee'
  | 'amazon'
  | 'magalu'
  | 'shein'
  | 'casas_bahia'
  | 'webcontinental'
  | 'madeiramadeira'

export type ConnectionStatus = 'active' | 'expired' | 'disconnected'

export interface Tenant {
  id: string
  name: string
  slug: string
  taxRegime: TaxRegime | null
  effectiveTaxRate: string | null
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  tenantId: string
  role: UserRole
  name: string
  email: string
  createdAt: Date
}

export interface MarketplaceConnection {
  id: string
  tenantId: string
  marketplace: Marketplace
  expiresAt: Date | null
  metadata: Record<string, unknown> | null
  status: ConnectionStatus
  createdAt: Date
  updatedAt: Date
}

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  bling: 'Bling ERP',
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  magalu: 'Magalu',
  shein: 'Shein',
  casas_bahia: 'Casas Bahia',
  webcontinental: 'WebContinental',
  madeiramadeira: 'MadeiraMadeira',
}
