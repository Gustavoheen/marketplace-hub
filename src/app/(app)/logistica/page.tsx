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
    .select('id, order_number, order_date, marketplace, status, total_amount, customer_name, customer_state, shipping_carrier, tracking_code, tracking_status, tracking_desc, tracking_date, nf_number')
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

  // ── Transportadoras ──────────────────────────────────────────────────────
  const carrierMap: Record<string, number> = {}
  for (const o of orders) {
    const key = o.shipping_carrier ? String(o.shipping_carrier).trim() : 'Não informado'
    carrierMap[key] = (carrierMap[key] || 0) + 1
  }
  const byCarrier = Object.entries(carrierMap)
    .map(([name, orders]) => ({ name, orders }))
    .sort((a, b) => b.orders - a.orders)

  // ── Tracking stats ───────────────────────────────────────────────────────
  const withTracking = orders.filter(o => o.tracking_status != null)
  const entregues   = withTracking.filter(o => Number(o.tracking_status) === 1).length
  const emEntrega   = withTracking.filter(o => [104, 91, 70].includes(Number(o.tracking_status))).length
  const emTransito  = withTracking.filter(o => [101, 102, 103, 83, 68, 0].includes(Number(o.tracking_status))).length
  const comProblema = withTracking.filter(o => {
    const c = Number(o.tracking_status)
    return c >= 6 && ![68, 83, 101, 102, 103, 104, 91, 70, 1].includes(c)
  }).length

  // ── Tabela de pedidos (todos, foco transporte) ───────────────────────────
  const orderTable = orders.slice(0, 200).map(o => ({
    id: o.id as string,
    order_number: o.order_number as string | null,
    nf_number: o.nf_number as string | null,
    customer_name: o.customer_name as string | null,
    customer_state: o.customer_state as string | null,
    marketplace: o.marketplace as string | null,
    status: o.status as string | null,
    shipping_carrier: o.shipping_carrier as string | null,
    tracking_code: o.tracking_code as string | null,
    tracking_status: o.tracking_status != null ? Number(o.tracking_status) : null,
    tracking_desc: o.tracking_desc as string | null,
    tracking_date: o.tracking_date as string | null,
    order_date: o.order_date as string,
  }))

  return (
    <div className="flex flex-col h-full">
      <Header title="Logística" description="Transportadoras, rastreio e status de entrega" />
      <LogisticaClient
        totalOrders={orders.length}
        semTracking={orders.length - withTracking.length}
        entregues={entregues}
        emEntrega={emEntrega}
        emTransito={emTransito}
        comProblema={comProblema}
        byCarrier={byCarrier}
        orderTable={orderTable}
        period={period}
        marketplace={params.marketplace}
        marketplaceOptions={distinctMarketplaces}
      />
    </div>
  )
}
