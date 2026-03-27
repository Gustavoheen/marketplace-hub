import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { Header } from '@/components/layout/header'
import { PedidosClient } from './pedidos-client'
import { cookies } from 'next/headers'

export const metadata = { title: 'Pedidos — Marketplace Hub' }

const STATUS_PENDENTE = ['em aberto', 'aguardando pagamento', 'em andamento', 'pendente', 'aguardando confirmacao', 'em producao']

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    marketplace?: string
    page?: string
    period?: string
    view?: string
  }>
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

  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = 25
  const offset = (page - 1) * pageSize
  const period = params.period || '30d'
  const view = params.view || 'todos'

  const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : period === 'all' ? 0 : 30
  const startDate = days > 0 ? new Date(Date.now() - days * 86400000).toISOString() : null

  // ── Query principal (sem raw_data para evitar payload pesado) ──────────────
  let query = svc
    .schema('marketplace')
    .from('orders')
    .select('id, bling_id, order_number, marketplace, status, total_amount, customer_name, customer_state, order_date, shipping_cost, discount_total', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('order_date', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (startDate) query = query.gte('order_date', startDate)
  if (params.q) query = query.ilike('customer_name', `%${params.q}%`)
  if (params.marketplace) query = query.eq('marketplace', params.marketplace as any)

  if (view === 'pendentes') {
    query = query.or(STATUS_PENDENTE.map(s => `status.ilike.%${s}%`).join(','))
  } else if (view === 'atendidos') {
    query = query.ilike('status', '%atendido%')
  } else if (view === 'cancelados') {
    query = query.ilike('status', '%cancel%')
  } else if (params.status) {
    query = query.ilike('status', `%${params.status}%`)
  }

  const { data: orders, count, error: ordersError } = await query

  if (ordersError) {
    console.error('[pedidos] query error:', ordersError)
  }

  // ── Contagens e filtros (queries leves, sem JOIN) ──────────────────────────
  const tid = tenantId
  const dateFilter = startDate || '2000-01-01'

  const { count: totalCount } = await svc
    .schema('marketplace').from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tid).gte('order_date', dateFilter)

  const { count: atendidoCount } = await svc
    .schema('marketplace').from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tid).gte('order_date', dateFilter)
    .ilike('status', '%atendido%')

  const { count: canceladoCount } = await svc
    .schema('marketplace').from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tid).gte('order_date', dateFilter)
    .ilike('status', '%cancel%')

  const { data: statusList } = await svc
    .schema('marketplace').from('orders')
    .select('status').eq('tenant_id', tid).limit(500)

  const { data: marketplaceList } = await svc
    .schema('marketplace').from('orders')
    .select('marketplace').eq('tenant_id', tid).limit(500)

  const distinctStatus = [...new Set((statusList || []).map((s: any) => s.status).filter(Boolean))].sort()
  const distinctMarketplaces = [...new Set((marketplaceList || []).map((m: any) => m.marketplace).filter(Boolean))].sort()

  const pendentesCount = Math.max(0, (totalCount || 0) - (atendidoCount || 0) - (canceladoCount || 0))

  return (
    <div className="flex flex-col h-full">
      <Header title="Pedidos" description="Histórico completo de vendas" />
      <PedidosClient
        orders={(orders || []) as any[]}
        total={count || 0}
        page={page}
        pageSize={pageSize}
        filters={{ q: params.q, status: params.status, marketplace: params.marketplace }}
        period={period}
        view={view}
        statusOptions={distinctStatus}
        marketplaceOptions={distinctMarketplaces}
        tabCounts={{
          todos: totalCount || 0,
          pendentes: pendentesCount,
          atendidos: atendidoCount || 0,
          cancelados: canceladoCount || 0,
        }}
      />
    </div>
  )
}
