import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { cookies } from 'next/headers'

// Alíquotas por regime tributário
const TAX_RATES: Record<string, number> = {
  mei:               0,
  simples:           6,
  simples_nacional:  6,
  lucro_presumido:   11.33,
  lucro_real:        9.25,
}

function getTaxRate(regime: string | null, override: number | null): number {
  if (override != null && override > 0) return override
  return TAX_RATES[regime || 'simples_nacional'] ?? 6
}

// Comissões padrão por marketplace (categoria geral, sem taxa fixa)
const DEFAULT_COMMISSION: Record<string, number> = {
  mercadolivre: 11,
  shopee:       14,
  amazon:       15,
  magalu:       12,
  americanas:   12,
  casas_bahia:  12,
  carrefour:    12,
  shein:        20,
  webcontinental: 12,
  madeiramadeira: 12,
  kabum:        13,
  netshoes:     14,
  bling:        0,
}

function getCommission(mp: string): number {
  const key = (mp || '').toLowerCase().replace(/\s+/g, '')
  return DEFAULT_COMMISSION[key] ?? 12
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '30d'
  const marketplace = searchParams.get('marketplace') || 'all'

  const cookieStore = await cookies()
  let tenantId = cookieStore.get('active_tenant_id')?.value

  if (!tenantId) {
    const result = await getUserWithTenant(user.id)
    if (!result) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })
    tenantId = result.tenant.id
  }

  const svc = createServiceClient()

  const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startIso = startDate.toISOString()

  // ── Fetch orders ──────────────────────────────────────────────────────────

  let ordersQuery = svc
    .schema('marketplace')
    .from('orders')
    .select('total_amount, marketplace, status, order_date, customer_name, shipping_cost, discount_total')
    .eq('tenant_id', tenantId)
    .gte('order_date', startIso)
    .order('order_date', { ascending: true })
    .limit(10000)  // garante que todos os pedidos do período sejam carregados

  if (marketplace !== 'all') {
    ordersQuery = ordersQuery.eq('marketplace', marketplace as any)
  }

  const [
    { data: orders },
    { data: products },
    { data: connections },
    { data: alerts },
    { data: tenantData },
  ] = await Promise.all([
    ordersQuery,
    svc.schema('marketplace').from('products')
      .select('id, sale_price, cost_price, stock_total')
      .eq('tenant_id', tenantId),
    svc.schema('marketplace').from('marketplace_connections')
      .select('marketplace, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    svc.schema('marketplace').from('agent_alerts')
      .select('id, severity, created_at')
      .eq('tenant_id', tenantId)
      .eq('resolved', false)
      .limit(10),
    svc.schema('marketplace').from('tenants')
      .select('tax_regime, effective_tax_rate')
      .eq('id', tenantId)
      .single(),
  ])

  const taxRate = getTaxRate(
    tenantData?.tax_regime ?? null,
    tenantData?.effective_tax_rate ? Number(tenantData.effective_tax_rate) : null
  )

  const safeOrders = orders || []
  const safeProducts = products || []

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const totalRevenue = safeOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
  const totalOrders = safeOrders.length
  const activeConnections = (connections || []).length

  // Margem média dos produtos com custo cadastrado
  const productsWithCost = safeProducts.filter(
    (p) => p.cost_price != null && p.sale_price != null && Number(p.sale_price) > 0
  )
  const avgMargin = productsWithCost.length
    ? productsWithCost.reduce((s, p) => {
        const m = ((Number(p.sale_price) - Number(p.cost_price)) / Number(p.sale_price)) * 100
        return s + m
      }, 0) / productsWithCost.length
    : null

  // Lucro estimado: receita − comissão − frete − imposto
  let estimatedProfit: number | null = null
  let totalCommission = 0
  let totalShippingPaid = 0
  let totalTax = 0

  if (safeOrders.length > 0) {
    estimatedProfit = 0
    for (const o of safeOrders) {
      const amount = Number(o.total_amount || 0)
      const commission = amount * (getCommission(o.marketplace || '') / 100)
      const shipping = Number(o.shipping_cost || 0)
      const tax = amount * (taxRate / 100)
      totalCommission += commission
      totalShippingPaid += shipping
      totalTax += tax
      estimatedProfit += amount - commission - shipping - tax
    }
  }

  // Lucro com custo de produto (se houver margem média)
  const netProfitEstimate = estimatedProfit != null && avgMargin != null
    ? totalRevenue * (avgMargin / 100) - totalCommission - totalShippingPaid
    : null

  // Previous period comparison
  const prevStart = new Date(startDate)
  prevStart.setDate(prevStart.getDate() - days)
  const { data: prevOrders } = await svc
    .schema('marketplace')
    .from('orders')
    .select('total_amount')
    .eq('tenant_id', tenantId)
    .gte('order_date', prevStart.toISOString())
    .lt('order_date', startIso)

  const prevRevenue = (prevOrders || []).reduce((s, o) => s + Number(o.total_amount || 0), 0)
  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null
  const orderChange = prevOrders?.length
    ? ((totalOrders - prevOrders.length) / prevOrders.length) * 100
    : null

  // ── Revenue trend (daily buckets) ─────────────────────────────────────────

  const revenueByDay: Record<string, number> = {}
  const ordersByDay: Record<string, number> = {}
  const profitByDay: Record<string, number> = {}

  for (const order of safeOrders) {
    const day = (order.order_date as string).slice(0, 10)
    const amount = Number(order.total_amount || 0)
    const commission = amount * (getCommission(order.marketplace || '') / 100)
    const shipping = Number(order.shipping_cost || 0)
    revenueByDay[day] = (revenueByDay[day] || 0) + amount
    ordersByDay[day] = (ordersByDay[day] || 0) + 1
    profitByDay[day] = (profitByDay[day] || 0) + (amount - commission - shipping - amount * (taxRate / 100))
  }

  const trend: Array<{ date: string; revenue: number; orders: number; profit: number }> = []
  for (let d = 0; d < days; d++) {
    const dt = new Date(startDate)
    dt.setDate(dt.getDate() + d)
    const key = dt.toISOString().slice(0, 10)
    trend.push({
      date: key,
      revenue: revenueByDay[key] || 0,
      orders: ordersByDay[key] || 0,
      profit: profitByDay[key] || 0,
    })
  }

  // ── Channel mix ───────────────────────────────────────────────────────────

  const channelMap: Record<string, { revenue: number; orders: number; commission: number }> = {}
  for (const order of safeOrders) {
    const ch = (order.marketplace as string) || 'outros'
    const amount = Number(order.total_amount || 0)
    if (!channelMap[ch]) channelMap[ch] = { revenue: 0, orders: 0, commission: 0 }
    channelMap[ch].revenue += amount
    channelMap[ch].orders += 1
    channelMap[ch].commission += amount * (getCommission(ch) / 100)
  }
  const channelMix = Object.entries(channelMap)
    .map(([name, v]) => ({
      name,
      value: Math.round(v.revenue * 100) / 100,
      orders: v.orders,
      commission: Math.round(v.commission * 100) / 100,
      commissionRate: getCommission(name),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // ── Status breakdown ──────────────────────────────────────────────────────

  const statusMap: Record<string, number> = {}
  let assistenciaCount = 0
  for (const order of safeOrders) {
    const s = (order.status as string) || 'unknown'
    statusMap[s] = (statusMap[s] || 0) + 1
    if (s.toLowerCase().includes('assist')) assistenciaCount++
  }

  // ── Geo: pedidos por estado ────────────────────────────────────────────────
  // Busca direto no banco com aggregation (mais eficiente que processar no JS)
  let stateQuery = svc
    .schema('marketplace')
    .from('orders')
    .select('customer_state, total_amount')
    .eq('tenant_id', tenantId)
    .gte('order_date', startIso)
    .not('customer_state', 'is', null)
    .limit(10000)

  if (marketplace !== 'all') {
    stateQuery = stateQuery.eq('marketplace', marketplace as any)
  }

  const { data: stateRows } = await stateQuery

  const stateMap: Record<string, { orders: number; revenue: number }> = {}
  for (const row of (stateRows || [])) {
    const uf = (row.customer_state as string).toUpperCase()
    if (!stateMap[uf]) stateMap[uf] = { orders: 0, revenue: 0 }
    stateMap[uf].orders += 1
    stateMap[uf].revenue += Number(row.total_amount || 0)
  }
  const geoBreakdown = Object.entries(stateMap)
    .map(([state, v]) => ({ state, orders: v.orders, revenue: Math.round(v.revenue * 100) / 100 }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 15)

  const totalWithState = (stateRows || []).length
  const totalWithoutState = totalOrders - totalWithState

  return NextResponse.json({
    kpis: {
      totalRevenue,
      totalOrders,
      avgMargin,
      activeConnections,
      revenueChange,
      orderChange,
      estimatedProfit,
      netProfitEstimate,
      totalCommission: Math.round(totalCommission * 100) / 100,
      totalShippingPaid: Math.round(totalShippingPaid * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      taxRate,
      taxRegime: tenantData?.tax_regime ?? 'simples_nacional',
      productsWithCost: productsWithCost.length,
      totalProducts: safeProducts.length,
      assistenciaCount,
    },
    trend,
    channelMix,
    statusBreakdown: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
    geoBreakdown,
    geoEnrichment: { withState: totalWithState, withoutState: totalWithoutState },
    pendingAlerts: (alerts || []).length,
    products: {
      total: safeProducts.length,
      lowStock: safeProducts.filter(p => Number(p.stock_total || 0) < 5).length,
      withCost: productsWithCost.length,
    },
  })
}
