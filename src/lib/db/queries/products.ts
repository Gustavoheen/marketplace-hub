import { createServiceClient } from '@/lib/supabase/service'
import type { BlingProduct } from '@/lib/integrations/bling'

const TABLE = 'products'

// ── Upsert produto vindo do Bling ─────────────────────────────────────────────

export async function upsertProduct(tenantId: string, produto: BlingProduct) {
  const supabase = createServiceClient()

  const row = {
    tenant_id: tenantId,
    bling_id: produto.id,
    sku: produto.codigo || null,
    name: produto.nome,
    description: produto.descricaoComplementar || produto.descricaoCurta || null,
    short_description: produto.descricaoCurta || null,
    cost_price: produto.precoCusto || null,
    sale_price: produto.preco || null,
    gtin: produto.gtin || null,
    ncm: produto.tributacao?.ncm || null,
    brand: produto.marca || null,
    weight_kg: produto.pesoLiquido ? Number(produto.pesoLiquido) / 1000 : null,
    width_cm: produto.largura ? Number(produto.largura) : null,
    height_cm: produto.altura ? Number(produto.altura) : null,
    depth_cm: produto.profundidade ? Number(produto.profundidade) : null,
    images: JSON.stringify(produto.imagens || []),
    stock_total: produto.estoque?.saldoVirtualTotal ?? 0,
    category_bling: (produto.categoria as any)?.descricao || null,
    status: produto.situacao === 'A' ? 'active' : 'inactive',
    raw_data: produto.raw,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .schema('marketplace')
    .from(TABLE)
    .upsert(row, { onConflict: 'tenant_id,bling_id' })

  if (error) throw new Error(`upsertProduct: ${error.message}`)
}

// ── Bulk upsert (sync completo) ───────────────────────────────────────────────

export async function bulkUpsertProducts(tenantId: string, produtos: BlingProduct[]) {
  const supabase = createServiceClient()

  const rows = produtos.map((produto) => ({
    tenant_id: tenantId,
    bling_id: produto.id,
    sku: produto.codigo || null,
    name: produto.nome,
    description: produto.descricaoComplementar || produto.descricaoCurta || null,
    short_description: produto.descricaoCurta || null,
    cost_price: produto.precoCusto || null,
    sale_price: produto.preco || null,
    gtin: produto.gtin || null,
    ncm: produto.tributacao?.ncm || null,
    brand: produto.marca || null,
    weight_kg: produto.pesoLiquido ? Number(produto.pesoLiquido) / 1000 : null,
    width_cm: produto.largura ? Number(produto.largura) : null,
    height_cm: produto.altura ? Number(produto.altura) : null,
    depth_cm: produto.profundidade ? Number(produto.profundidade) : null,
    images: JSON.stringify(produto.imagens || []),
    stock_total: produto.estoque?.saldoVirtualTotal ?? 0,
    category_bling: (produto.categoria as any)?.descricao || null,
    status: produto.situacao === 'A' ? 'active' : 'inactive',
    raw_data: produto.raw,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  // Upsert em lotes de 50 para evitar timeout
  for (let i = 0; i < rows.length; i += 50) {
    const lote = rows.slice(i, i + 50)
    const { error } = await supabase
      .schema('marketplace')
      .from(TABLE)
      .upsert(lote, { onConflict: 'tenant_id,bling_id' })
    if (error) throw new Error(`bulkUpsertProducts lote ${i}: ${error.message}`)
  }
}

// ── Listar produtos ───────────────────────────────────────────────────────────

export async function listProducts(tenantId: string, options: {
  limit?: number
  offset?: number
  search?: string
  status?: string
} = {}) {
  const supabase = createServiceClient()
  const { limit = 50, offset = 0, search, status } = options

  let query = supabase
    .schema('marketplace')
    .from(TABLE)
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('name')
    .range(offset, offset + limit - 1)

  if (search) query = query.ilike('name', `%${search}%`)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) throw new Error(`listProducts: ${error.message}`)

  return { products: data || [], total: count || 0 }
}

// ── Contar produtos ───────────────────────────────────────────────────────────

export async function countProducts(tenantId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count, error } = await supabase
    .schema('marketplace')
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  if (error) return 0
  return count || 0
}
