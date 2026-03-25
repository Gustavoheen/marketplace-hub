import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '30d'
  const marketplace = searchParams.get('marketplace') || 'all'

  // Resolve tenant — cookie first, fallback to DB lookup
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
    .select('total_amount, items_count, marketplace, status, order_date, customer_name')
    .eq('tenant_id', tenantId)
    .gte('order_date', startIso)
    .order('order_date', { ascending: true })

  if (marketplace !== 'all') {
    ordersQuery = ordersQuery.eq('marketplace', marketplace)
  }

  const [
    { data: orders },
    { data: products },
    { data: connections },
    { data: alerts },
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
  ])

  const safeOrders = orders || []
  const safeProducts = products || []

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const totalRevenue = safeOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
  const totalOrders = safeOrders.length
  const activeConnections = (connections || []).length

  // Margem média: usa sale_price e cost_price
  const productsWithCost = safeProducts.filter(
    (p) => p.cost_price != null && p.sale_price != null && Number(p.sale_price) > 0
  )
  const avgMargin = productsWithCost.length
    ? productsWithCost.reduce((s, p) => {
        const m = ((Number(p.sale_price) - Number(p.cost_price)) / Number(p.sale_price)) * 100
        return s + m
      }, 0) / productsWithCost.length
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

  for (const order of safeOrders) {
    const day = (order.order_date as string).slice(0, 10)
    revenueByDay[day] = (revenueByDay[day] || 0) + Number(order.total_amount || 0)
    ordersByDay[day] = (ordersByDay[day] || 0) + 1
  }

  const trend: Array<{ date: string; revenue: number; orders: number }> = []
  for (let d = 0; d < days; d++) {
    const dt = new Date(startDate)
    dt.setDate(dt.getDate() + d)
    const key = dt.toISOString().slice(0, 10)
    trend.push({ date: key, revenue: revenueByDay[key] || 0, orders: ordersByDay[key] || 0 })
  }

  // ── Channel mix ───────────────────────────────────────────────────────────

  const channelMap: Record<string, number> = {}
  for (const order of safeOrders) {
    const ch = (order.marketplace as string) || 'outros'
    channelMap[ch] = (channelMap[ch] || 0) + Number(order.total_amount || 0)
  }
  const channelMix = Object.entries(channelMap)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // ── Status breakdown ──────────────────────────────────────────────────────

  const statusMap: Record<string, number> = {}
  for (const order of safeOrders) {
    const s = (order.status as string) || 'unknown'
    statusMap[s] = (statusMap[s] || 0) + 1
  }

  return NextResponse.json({
    kpis: {
      totalRevenue,
      totalOrders,
      avgMargin,
      activeConnections,
      revenueChange,
      orderChange,
    },
    trend,
    channelMix,
    statusBreakdown: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
    pendingAlerts: (alerts || []).length,
    products: {
      total: safeProducts.length,
      lowStock: safeProducts.filter(p => Number(p.stock_total || 0) < 5).length,
    },
  })
}
