import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { getConnection, upsertConnection } from '@/lib/db/queries/connections'
import { blingGetPedidoDetalhe, blingRefreshToken } from '@/lib/integrations/bling'
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

  // ── Contagens no banco ─────────────────────────────────────────────────────
  const { count: totalOrders } = await svc
    .schema('marketplace').from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const { count: withState } = await svc
    .schema('marketplace').from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .not('customer_state', 'is', null)

  // ── Amostra dos estados existentes ─────────────────────────────────────────
  const { data: stateSample } = await svc
    .schema('marketplace').from('orders')
    .select('customer_state, marketplace')
    .eq('tenant_id', tenantId)
    .not('customer_state', 'is', null)
    .limit(5)

  // ── Ver o raw_data de um pedido sem estado ─────────────────────────────────
  const { data: sampleOrders } = await svc
    .schema('marketplace').from('orders')
    .select('id, bling_id, marketplace, raw_data')
    .eq('tenant_id', tenantId)
    .is('customer_state', null)
    .not('bling_id', 'is', null)
    .limit(3)

  // Chaves do raw_data para ver quais campos existem
  const rawDataKeys = sampleOrders?.map(o => ({
    bling_id: o.bling_id,
    marketplace: o.marketplace,
    rawTopKeys: o.raw_data ? Object.keys(o.raw_data as object) : [],
    hasEnderecoEntrega: !!(o.raw_data as any)?.enderecoEntrega,
    enderecoEntregaUf: (o.raw_data as any)?.enderecoEntrega?.uf || null,
    hasContatoEndereco: !!(o.raw_data as any)?.contato?.endereco,
    contatoEnderecoUf: (o.raw_data as any)?.contato?.endereco?.uf || null,
  }))

  // ── Testar chamada real ao Bling Detail API ────────────────────────────────
  let blingDetailTest: any = null
  const firstOrder = sampleOrders?.[0]

  if (firstOrder?.bling_id) {
    try {
      const connection = await getConnection(tenantId!, 'bling')
      if (connection && connection.status === 'active') {
        let accessToken = connection.accessToken
        if (connection.expiresAt.getTime() - Date.now() < 10 * 60 * 1000) {
          const fresh = await blingRefreshToken(connection.refreshToken)
          await upsertConnection({ tenantId: tenantId!, marketplace: 'bling', ...fresh })
          accessToken = fresh.accessToken
        }

        const detail = await blingGetPedidoDetalhe(accessToken, firstOrder.bling_id)
        blingDetailTest = {
          bling_id: firstOrder.bling_id,
          topKeys: Object.keys((detail as any) || {}),
          hasData: !!(detail as any)?.data,
          dataKeys: (detail as any)?.data ? Object.keys((detail as any).data) : [],
          enderecoEntrega: (detail as any)?.data?.enderecoEntrega || (detail as any)?.enderecoEntrega || null,
          contatoEndereco: (detail as any)?.data?.contato?.endereco || (detail as any)?.contato?.endereco || null,
          uf_found: (detail as any)?.data?.enderecoEntrega?.uf
            || (detail as any)?.enderecoEntrega?.uf
            || (detail as any)?.data?.contato?.endereco?.uf
            || (detail as any)?.contato?.endereco?.uf
            || null,
        }
      } else {
        blingDetailTest = { error: 'Bling não conectado' }
      }
    } catch (err: any) {
      blingDetailTest = { error: err.message }
    }
  }

  return NextResponse.json({
    tenantId,
    totalOrders,
    withState,
    withoutState: (totalOrders ?? 0) - (withState ?? 0),
    stateSample,
    rawDataKeys,
    blingDetailTest,
  })
}
