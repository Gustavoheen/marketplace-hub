import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { Header } from '@/components/layout/header'
import { LogisticaClient } from './logistica-client'
import { cookies } from 'next/headers'

export const metadata = { title: 'Logística — Marketplace Hub' }

export default async function LogisticaPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; marketplace?: string }>
}) {
  const params = await searchParams

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const cookieStore = await cookies()
  let tenantId = cookieStore.get('active_tenant_id')?.value
  if (!tenantId) {
    const result = await getUserWithTenant(authUser.id)
    if (!result) redirect('/login')
    tenantId = result.tenant.id
  }

  const svc = createServiceClient()
  const period = params.period || '30d'
  const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : period === 'all' ? 0 : 30
  const startDate = days > 0 ? new Date(Date.now() - days * 86400000).toISOString() : null

  let orderQuery = svc.schema('marketplace').from('orders')
    .select('id, order_date, marketplace, status, total_amount, shipping_cost, customer_state, shipping_carrier')
    .eq('tenant_id', tenantId!)
    .order('order_date', { ascending: false })
    .limit(5000)
  if (startDate) orderQuery = orderQuery.gte('order_date', startDate)
  if (params.marketplace) orderQuery = orderQuery.eq('marketplace', params.marketplace)

  const [
    { data: orderRows },
    { data: marketplaceList },
  ] = await Promise.all([
    orderQuery,
    svc.schema('marketplace').from('orders')
      .select('marketplace')
      .eq('tenant_id', tenantId!)
      .limit(1000),
  ])

  const orders = (orderRows || []) as any[]
  const distinctMarketplaces = [...new Set((marketplaceList || []).map((m: any) => m.marketplace).filter(Boolean))].sort() as string[]

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalFrete = orders.reduce((s, o) => s + Number(o.shipping_cost || 0), 0)
  const pedidosComFrete = orders.filter(o => Number(o.shipping_cost || 0) > 0).length
  const freteMedia = pedidosComFrete > 0 ? totalFrete / pedidosComFrete : 0
  const freightPct = orders.length > 0 ? (pedidosComFrete / orders.length) * 100 : 0

  // ── Frete por dia ──────────────────────────────────────────────────────────
  const freteByDay: Record<string, { frete: number; orders: number }> = {}
  for (const o of orders) {
    const day = (o.order_date as string).slice(0, 10)
    if (!freteByDay[day]) freteByDay[day] = { frete: 0, orders: 0 }
    freteByDay[day].frete += Number(o.shipping_cost || 0)
    freteByDay[day].orders += 1
  }
  const trendDays = days > 0 ? days : 30
  const trend: Array<{ date: string; frete: number; orders: number }> = []
  const startDt = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000)
  for (let d = 0; d < trendDays; d++) {
    const dt = new Date(startDt)
    dt.setDate(dt.getDate() + d)
    const key = dt.toISOString().slice(0, 10)
    trend.push({ date: key, frete: freteByDay[key]?.frete || 0, orders: freteByDay[key]?.orders || 0 })
  }

  // ── Por marketplace ────────────────────────────────────────────────────────
  const mpMap: Record<string, { frete: number; orders: number; revenue: number }> = {}
  for (const o of orders) {
    const mp = (o.marketplace as string) || 'outros'
    if (!mpMap[mp]) mpMap[mp] = { frete: 0, orders: 0, revenue: 0 }
    mpMap[mp].frete += Number(o.shipping_cost || 0)
    mpMap[mp].orders += 1
    mpMap[mp].revenue += Number(o.total_amount || 0)
  }
  const byMarketplace = Object.entries(mpMap)
    .map(([name, v]) => ({
      name,
      frete: Math.round(v.frete * 100) / 100,
      orders: v.orders,
      freteMedia: v.orders > 0 ? Math.round((v.frete / v.orders) * 100) / 100 : 0,
      fretePct: v.revenue > 0 ? Math.round((v.frete / v.revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.frete - a.frete)

  // ── Por estado ─────────────────────────────────────────────────────────────
  const stateMap: Record<string, { orders: number; frete: number }> = {}
  for (const o of orders) {
    const uf = o.customer_state ? String(o.customer_state).toUpperCase() : null
    if (!uf) continue
    if (!stateMap[uf]) stateMap[uf] = { orders: 0, frete: 0 }
    stateMap[uf].orders += 1
    stateMap[uf].frete += Number(o.shipping_cost || 0)
  }
  const byState = Object.entries(stateMap)
    .map(([state, v]) => ({ state, orders: v.orders, frete: Math.round(v.frete * 100) / 100, freteMedia: v.orders > 0 ? Math.round((v.frete / v.orders) * 100) / 100 : 0 }))
    .sort((a, b) => b.frete - a.frete)

  // ── Transportadoras ───────────────────────────────────────────────────────
  const carrierMap: Record<string, { orders: number; frete: number }> = {}
  for (const o of orders) {
    const key = o.shipping_carrier ? String(o.shipping_carrier).trim() : 'Não informado'
    if (!carrierMap[key]) carrierMap[key] = { orders: 0, frete: 0 }
    carrierMap[key].orders += 1
    carrierMap[key].frete += Number(o.shipping_cost || 0)
  }
  const byCarrier = Object.entries(carrierMap)
    .map(([name, v]) => ({ name, orders: v.orders, frete: Math.round(v.frete * 100) / 100 }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10)

  const semEstado = orders.filter(o => !o.customer_state).length

  return (
    <div className="flex flex-col h-full">
      <Header title="Logística" description="Análise de frete, transportadoras e rotas" />
      <LogisticaClient
        kpis={{
          totalFrete: Math.round(totalFrete * 100) / 100,
          freteMedia: Math.round(freteMedia * 100) / 100,
          pedidosComFrete,
          totalOrders: orders.length,
          freightPct: Math.round(freightPct * 10) / 10,
        }}
        trend={trend}
        byMarketplace={byMarketplace}
        byState={byState}
        byCarrier={byCarrier}
        semEstado={semEstado}
        period={period}
        marketplace={params.marketplace}
        marketplaceOptions={distinctMarketplaces}
      />
    </div>
  )
}
