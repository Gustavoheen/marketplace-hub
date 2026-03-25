import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  decimal,
  integer,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const taxRegimeEnum = pgEnum('tax_regime', [
  'simples_nacional',
  'lucro_presumido',
  'lucro_real',
])

export const userRoleEnum = pgEnum('user_role', ['admin', 'analyst', 'viewer'])

export const connectionStatusEnum = pgEnum('connection_status', [
  'active',
  'expired',
  'disconnected',
])

export const marketplaceEnum = pgEnum('marketplace', [
  'bling',
  'mercadolivre',
  'shopee',
  'amazon',
  'magalu',
  'shein',
  'casas_bahia',
  'webcontinental',
  'madeiramadeira',
])

// ─── Tenants ─────────────────────────────────────────────────────────────────

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    taxRegime: taxRegimeEnum('tax_regime').default('simples_nacional'),
    effectiveTaxRate: decimal('effective_tax_rate', { precision: 5, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('tenants_slug_idx').on(t.slug)]
)

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(), // referencia auth.users(id) do Supabase
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').default('analyst').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('users_tenant_idx').on(t.tenantId)]
)

// ─── Marketplace Connections ─────────────────────────────────────────────────

export const marketplaceConnections = pgTable(
  'marketplace_connections',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    marketplace: marketplaceEnum('marketplace').notNull(),
    accessToken: text('access_token'), // criptografado via AES-256
    refreshToken: text('refresh_token'), // criptografado via AES-256
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    metadata: jsonb('metadata'), // user_id, seller_id, account_name, etc.
    status: connectionStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('connections_tenant_idx').on(t.tenantId),
    uniqueIndex('connections_tenant_marketplace_idx').on(t.tenantId, t.marketplace),
  ]
)

// ─── Products ────────────────────────────────────────────────────────────────

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    blingId: text('bling_id'),
    sku: text('sku'),
    name: text('name').notNull(),
    description: text('description'),
    shortDescription: text('short_description'),
    costPrice: decimal('cost_price', { precision: 12, scale: 2 }),
    salePrice: decimal('sale_price', { precision: 12, scale: 2 }),
    gtin: text('gtin'), // EAN/GTIN
    ncm: text('ncm'),
    brand: text('brand'),
    weightKg: decimal('weight_kg', { precision: 8, scale: 3 }),
    widthCm: decimal('width_cm', { precision: 8, scale: 2 }),
    heightCm: decimal('height_cm', { precision: 8, scale: 2 }),
    depthCm: decimal('depth_cm', { precision: 8, scale: 2 }),
    images: jsonb('images').$type<string[]>().default([]),
    stockTotal: integer('stock_total').default(0),
    categoryBling: text('category_bling'),
    status: text('status').default('active'),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
  },
  (t) => [
    index('products_tenant_idx').on(t.tenantId),
    index('products_bling_id_idx').on(t.blingId),
    index('products_sku_idx').on(t.sku),
  ]
)

// ─── Product Listings ────────────────────────────────────────────────────────

export const productListings = pgTable(
  'product_listings',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    marketplace: marketplaceEnum('marketplace').notNull(),
    externalId: text('external_id'), // ML item_id, Shopee item_id, etc.
    categoryId: text('category_id'),
    listingUrl: text('listing_url'),
    price: decimal('price', { precision: 12, scale: 2 }),
    status: text('status').default('active'),
    attributes: jsonb('attributes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('listings_tenant_idx').on(t.tenantId),
    index('listings_product_idx').on(t.productId),
    uniqueIndex('listings_external_idx').on(t.tenantId, t.marketplace, t.externalId),
  ]
)

// ─── Orders ──────────────────────────────────────────────────────────────────

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    blingId: text('bling_id'),
    marketplace: marketplaceEnum('marketplace'),
    externalOrderId: text('external_order_id'),
    customerName: text('customer_name'),
    customerState: text('customer_state'), // UF
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }),
    shippingCost: decimal('shipping_cost', { precision: 12, scale: 2 }),
    marketplaceFee: decimal('marketplace_fee', { precision: 12, scale: 2 }),
    status: text('status'),
    orderDate: timestamp('order_date', { withTimezone: true }),
    shippedDate: timestamp('shipped_date', { withTimezone: true }),
    deliveredDate: timestamp('delivered_date', { withTimezone: true }),
    items: jsonb('items'), // line items
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
  },
  (t) => [
    index('orders_tenant_idx').on(t.tenantId),
    index('orders_date_idx').on(t.orderDate),
    index('orders_bling_idx').on(t.blingId),
  ]
)

// ─── Shared Dashboards ───────────────────────────────────────────────────────

export const sharedDashboards = pgTable(
  'shared_dashboards',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => users.id),
    name: text('name').notNull(),
    token: text('token').notNull(),
    passwordHash: text('password_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    visibleMetrics: jsonb('visible_metrics').notNull().$type<Record<string, boolean>>(),
    filters: jsonb('filters'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('dashboards_tenant_idx').on(t.tenantId),
    uniqueIndex('dashboards_token_idx').on(t.token),
  ]
)

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    details: jsonb('details'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('audit_tenant_idx').on(t.tenantId)]
)

// ─── Relations ───────────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  connections: many(marketplaceConnections),
  products: many(products),
  orders: many(orders),
  sharedDashboards: many(sharedDashboards),
}))

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, { fields: [products.tenantId], references: [tenants.id] }),
  listings: many(productListings),
}))

export const ordersRelations = relations(orders, ({ one }) => ({
  tenant: one(tenants, { fields: [orders.tenantId], references: [tenants.id] }),
}))
