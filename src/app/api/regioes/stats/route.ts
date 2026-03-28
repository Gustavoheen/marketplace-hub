import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { cookies } from 'next/headers'

// Mapeamento de UF → Região
const UF_TO_REGION: Record<string, string> = {
  AC: 'Norte', AM: 'Norte', AP: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte',
  AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste',
  PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste',
  DF: 'Centro-Oeste', GO: 'Centro-Oeste', MS: 'Centro-Oeste', MT: 'Centro-Oeste',
  ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste',
  PR: 'Sul', RS: 'Sul', SC: 'Sul',
}

const STATE_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
}

const REGIONS = ['Sudeste', 'Sul', 'Nordeste', 'Centro-Oeste', 'Norte']

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

  let startIso: string
  let endIso: string | null = null

  if (period === 'yesterday') {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    y.setHours(0, 0, 0, 0)
    const yEnd = new Date(y)
    yEnd.setHours(23, 59, 59, 999)
    startIso = y.toISOString()
    endIso = yEnd.toISOString()
  } else {
    const days = period === '1d' ? 1 : period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)
    startIso = startDate.toISOString()
  }

  // ── Fetch orders with geo + item data ─────────────────────────────────────
  let ordersQuery = svc
    .schema('marketplace')
    .from('orders')
    .select('total_amount, marketplace, customer_state, order_date, shipped_date, delivered_date, items')
    .eq('tenant_id', tenantId)
    .gte('order_date', startIso)
    .not('customer_state', 'is', null)
    .order('order_date', { ascending: false })
    .limit(10000)

  if (endIso) ordersQuery = ordersQuery.lte('order_date', endIso)
  if (marketplace !== 'all') ordersQuery = ordersQuery.eq('marketplace', marketplace as any)

  const { data: orders } = await ordersQuery

  const safeOrders = orders || []

  // ── Aggregate by state ────────────────────────────────────────────────────
  const stateMap: Record<string, {
    orders: number
    revenue: number
    deliveryDays: number[]
    products: Record<string, number>
  }> = {}

  for (const o of safeOrders) {
    const uf = ((o.customer_state as string) || '').toUpperCase().trim()
    if (!uf) continue
    if (!stateMap[uf]) stateMap[uf] = { orders: 0, revenue: 0, deliveryDays: [], products: {} }

    stateMap[uf].orders += 1
    stateMap[uf].revenue += Number(o.total_amount || 0)

    // Avg delivery time
    if (o.order_date && o.delivered_date) {
      const days = (new Date(o.delivered_date as string).getTime() - new Date(o.order_date as string).getTime()) / 86400000
      if (days > 0 && days < 60) stateMap[uf].deliveryDays.push(days)
    }

    // Top product
    const items = o.items as any
    if (items) {
      const itemsArr = Array.isArray(items) ? items : (items.items || items.produtos || [])
      for (const item of itemsArr) {
        const name = item.descricao || item.nome || item.name || item.description
        if (name) {
          stateMap[uf].products[name] = (stateMap[uf].products[name] || 0) + (item.quantidade || item.qty || item.quantity || 1)
        }
      }
    }
  }

  // ── Build state list ───────────────────────────────────────────────────────
  const totalOrders = safeOrders.length
  const totalRevenue = safeOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0)

  const stateList = Object.entries(stateMap).map(([uf, v]) => {
    const avgDelivery = v.deliveryDays.length > 0
      ? Math.round(v.deliveryDays.reduce((s, d) => s + d, 0) / v.deliveryDays.length)
      : null
    const topProduct = Object.entries(v.products).sort((a, b) => b[1] - a[1])[0]?.[0] || null
    return {
      uf,
      name: STATE_NAMES[uf] || uf,
      region: UF_TO_REGION[uf] || 'Outros',
      orders: v.orders,
      revenue: Math.round(v.revenue * 100) / 100,
      pct: totalOrders > 0 ? Math.round((v.orders / totalOrders) * 1000) / 10 : 0,
      avgDeliveryDays: avgDelivery,
      topProduct,
    }
  }).sort((a, b) => b.orders - a.orders)

  // ── Aggregate by region ───────────────────────────────────────────────────
  const regionMap: Record<string, { orders: number; revenue: number; states: number }> = {}
  for (const state of stateList) {
    const r = state.region
    if (!regionMap[r]) regionMap[r] = { orders: 0, revenue: 0, states: 0 }
    regionMap[r].orders += state.orders
    regionMap[r].revenue += state.revenue
    regionMap[r].states += 1
  }

  const regionList = REGIONS.map(name => ({
    name,
    orders: regionMap[name]?.orders || 0,
    revenue: Math.round((regionMap[name]?.revenue || 0) * 100) / 100,
    states: regionMap[name]?.states || 0,
  }))

  // Top 15 states for bar chart
  const topStates = stateList.slice(0, 15).map(s => ({
    uf: s.uf,
    orders: s.orders,
    revenue: s.revenue,
  }))

  return NextResponse.json({
    summary: { totalOrders, totalRevenue: Math.round(totalRevenue * 100) / 100 },
    regions: regionList,
    states: stateList,
    topStates,
  })
}
