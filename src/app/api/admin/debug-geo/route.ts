import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { cookies } from 'next/headers'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cookieStore = await cookies()
  let tenantId = cookieStore.get('active_tenant_id')?.value
  if (!tenantId) {
    const result = await getUserWithTenant(user.id)
    if (!result) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
    tenantId = result.tenant.id
  }

  const svc = createServiceClient()

  // Total de pedidos no tenant
  const { count: totalOrders } = await svc
    .schema('marketplace').from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  // Pedidos com customer_state preenchido
  const { count: withState } = await svc
    .schema('marketplace').from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .not('customer_state', 'is', null)

  // Amostra dos estados existentes
  const { data: sample, error: sampleErr } = await svc
    .schema('marketplace').from('orders')
    .select('customer_state, order_date')
    .eq('tenant_id', tenantId)
    .not('customer_state', 'is', null)
    .order('order_date', { ascending: false })
    .limit(10)

  // Query exata que o dashboard usa (30d)
  const startIso = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: stateRows, error: geoErr } = await svc
    .schema('marketplace').from('orders')
    .select('customer_state, total_amount')
    .eq('tenant_id', tenantId)
    .gte('order_date', startIso)
    .not('customer_state', 'is', null)
    .limit(10000)

  return NextResponse.json({
    tenantId,
    totalOrders,
    withState,
    withoutState: (totalOrders ?? 0) - (withState ?? 0),
    sampleError: sampleErr?.message,
    sample,
    geoQueryError: geoErr?.message,
    geoRowCount: stateRows?.length ?? 0,
    startIso,
  })
}
