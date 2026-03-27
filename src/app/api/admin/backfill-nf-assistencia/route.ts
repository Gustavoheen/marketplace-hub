import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { cookies } from 'next/headers'
import { getConnection, upsertConnection } from '@/lib/db/queries/connections'
import { blingRefreshToken, blingGetPedidoDetalhe } from '@/lib/integrations/bling'

const NF_REGEX = /\bNF\s*:?\s*(\d+)/i

/**
 * Extrai o número da NF de assistência das ocorrências do pedido Bling.
 * Busca nos campos `observacoes` e `descricao` de cada ocorrência pelo padrão "NF 1234".
 */
function extractNfAssistencia(detail: any): string | null {
  const ocorrencias: any[] =
    detail?.data?.ocorrencias ??
    detail?.ocorrencias ??
    []

  for (const oc of ocorrencias) {
    const textos = [oc?.observacoes, oc?.descricao, oc?.obs].filter(Boolean)
    for (const texto of textos) {
      const match = String(texto).match(NF_REGEX)
      if (match?.[1]) return match[1]
    }
  }
  return null
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

  // Pedidos de assistência já faturada que ainda não têm nf_assistencia preenchida
  const { data: orders } = await svc
    .schema('marketplace').from('orders')
    .select('id, bling_id, order_number')
    .eq('tenant_id', tenantId)
    .is('nf_assistencia', null)
    .not('bling_id', 'is', null)
    .or('status.ilike.%assistência faturada%,status.ilike.%assistencia faturada%')
    .limit(batchSize)

  if (!orders?.length) {
    // Conta total de assistências faturadas para informar o usuário
    const { count } = await svc
      .schema('marketplace').from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('nf_assistencia', null)
      .or('status.ilike.%assistência faturada%,status.ilike.%assistencia faturada%')
    return NextResponse.json({ updated: 0, remaining: count ?? 0, message: 'Nenhuma assistência faturada pendente' })
  }

  let updated = 0
  const errors: string[] = []
  const notFound: string[] = []

  for (const order of orders) {
    try {
      const detail = await blingGetPedidoDetalhe(accessToken, order.bling_id!)
      const nfAssistencia = extractNfAssistencia(detail)

      if (nfAssistencia) {
        const { error } = await svc
          .schema('marketplace').from('orders')
          .update({ nf_assistencia: nfAssistencia })
          .eq('id', order.id)
        if (!error) updated++
        else errors.push(`${order.order_number}: ${error.message}`)
      } else {
        notFound.push(order.order_number ?? order.bling_id!)
      }

      await sleep(150) // respeita rate limit do Bling
    } catch (err: any) {
      errors.push(`${order.bling_id}: ${err.message}`)
    }
  }

  const { count: remaining } = await svc
    .schema('marketplace').from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('nf_assistencia', null)
    .or('status.ilike.%assistência faturada%,status.ilike.%assistencia faturada%')

  return NextResponse.json({
    updated,
    processed: orders.length,
    remaining: remaining ?? 0,
    not_found: notFound,
    errors,
  })
}
