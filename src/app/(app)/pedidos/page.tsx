import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { Header } from '@/components/layout/header'
import { PedidosClient } from './pedidos-client'

export const metadata = { title: 'Pedidos — Marketplace Hub' }

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; marketplace?: string; page?: string }>
}) {
  const params = await searchParams

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const result = await getUserWithTenant(authUser.id)
  if (!result) redirect('/login')

  const tenantId = result.tenant.id
  const svc = createServiceClient()

  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = 20
  const offset = (page - 1) * pageSize

  let query = svc
    .schema('marketplace')
    .from('orders')
    .select('id, bling_id, marketplace, status, total_amount, items_count, customer_name, order_date', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('order_date', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (params.q) query = query.ilike('customer_name', `%${params.q}%`)
  if (params.status) query = query.eq('status', params.status)
  if (params.marketplace) query = query.eq('marketplace', params.marketplace)

  const { data: orders, count } = await query

  // Status distintos para o filtro
  const { data: statusList } = await svc
    .schema('marketplace')
    .from('orders')
    .select('status')
    .eq('tenant_id', tenantId)
    .order('status')

  const distinctStatus = [...new Set((statusList || []).map(s => s.status).filter(Boolean))]

  return (
    <div className="flex flex-col h-full">
      <Header title="Pedidos" description="Histórico de vendas" />
      <PedidosClient
        orders={orders || []}
        total={count || 0}
        page={page}
        pageSize={pageSize}
        filters={{ q: params.q, status: params.status, marketplace: params.marketplace }}
        statusOptions={distinctStatus}
      />
    </div>
  )
}
