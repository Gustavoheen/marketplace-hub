import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { cookies } from 'next/headers'
import { getConnection, upsertConnection } from '@/lib/db/queries/connections'
import { blingRefreshToken, blingGetPedidoDetalhe } from '@/lib/integrations/bling'

// Busca estado do pedido a partir do detalhe do Bling
function extractUF(detail: any): string | null {
  const uf = detail?.enderecoEntrega?.uf
    || detail?.data?.enderecoEntrega?.uf
    || detail?.contato?.endereco?.uf
    || detail?.data?.contato?.endereco?.uf
    || null
  return uf ? String(uf).toUpperCase() : null
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => ({}))
  const batchSize: number = Math.min(Number(body.batchSize) || 50, 100)

  const connection = await getConnection(tenantId!, 'bling')
  if (!connection || connection.status !== 'active') {
    return NextResponse.json({ error: 'Bling não conectado' }, { status: 400 })
  }

  let accessToken = connection.accessToken
  if (connection.expiresAt.getTime() - Date.now() < 10 * 60 * 1000) {
    const fresh = await blingRefreshToken(connection.refreshToken)
    await upsertConnection({ tenantId: tenantId!, marketplace: 'bling', ...fresh })
    accessToken = fresh.accessToken
  }

  const svc = createServiceClient()

  // Pedidos sem customer_state que têm bling_id
  const { data: orders } = await svc
    .schema('marketplace').from('orders')
    .select('id, bling_id')
    .eq('tenant_id', tenantId)
    .is('customer_state', null)
    .not('bling_id', 'is', null)
    .limit(batchSize)

  if (!orders?.length) {
    return NextResponse.json({ updated: 0, remaining: 0, message: 'Todos os pedidos já têm estado preenchido' })
  }

  let updated = 0
  const errors: string[] = []

  for (const order of orders) {
    try {
      const detail = await blingGetPedidoDetalhe(accessToken, order.bling_id!)
      const uf = extractUF(detail)
      if (uf) {
        const { error } = await svc
          .schema('marketplace').from('orders')
          .update({ customer_state: uf })
          .eq('id', order.id)
        if (!error) updated++
      }
      await sleep(150) // respeita rate limit do Bling
    } catch (err: any) {
      errors.push(`${order.bling_id}: ${err.message}`)
    }
  }

  // Conta quantos ainda faltam
  const { count: remaining } = await svc
    .schema('marketplace').from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('customer_state', null)
    .not('bling_id', 'is', null)

  return NextResponse.json({ updated, processed: orders.length, remaining: remaining ?? 0, errors })
}
