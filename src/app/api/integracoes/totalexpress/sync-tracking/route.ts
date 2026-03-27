import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { cookies } from 'next/headers'
import { obterTracking } from '@/lib/integrations/totalexpress'

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
  const dataConsulta: string | undefined = body.dataConsulta // ex: "2024-01-15"

  let events
  try {
    events = await obterTracking(dataConsulta)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 })
  }

  if (!events.length) {
    return NextResponse.json({ updated: 0, message: 'Nenhum evento de tracking disponível' })
  }

  const svc = createServiceClient()

  // Buscar pedidos do tenant que podem ser matcheados
  const pedidoNums = [...new Set(events.map(e => e.pedido).filter(Boolean))]
  const nfNums = [...new Set(events.map(e => e.notaFiscal).filter(Boolean))]

  const { data: orders } = await svc
    .schema('marketplace')
    .from('orders')
    .select('id, order_number, nf_number, nf_assistencia, tracking_date')
    .eq('tenant_id', tenantId)
    .or([
      pedidoNums.length ? `order_number.in.(${pedidoNums.map(n => `"${n}"`).join(',')})` : null,
      nfNums.length ? `nf_number.in.(${nfNums.map(n => `"${n}"`).join(',')})` : null,
      nfNums.length ? `nf_assistencia.in.(${nfNums.map(n => `"${n}"`).join(',')})` : null,
    ].filter(Boolean).join(','))

  if (!orders?.length) {
    return NextResponse.json({ updated: 0, message: 'Nenhum pedido correspondente encontrado' })
  }

  // Indexar por order_number, nf_number e nf_assistencia para lookup rápido
  const byOrderNum: Record<string, string> = {}
  const byNfNum: Record<string, string> = {}
  const byNfAssistencia: Record<string, string> = {}
  for (const o of orders) {
    if (o.order_number) byOrderNum[o.order_number] = o.id
    if (o.nf_number) byNfNum[o.nf_number] = o.id
    if (o.nf_assistencia) byNfAssistencia[o.nf_assistencia] = o.id
  }

  // Para cada pedido, pegar o evento mais recente (maior dataStatus)
  const latestByOrder: Record<string, typeof events[0]> = {}
  for (const ev of events) {
    const orderId = byOrderNum[ev.pedido] ?? byNfNum[ev.notaFiscal] ?? byNfAssistencia[ev.notaFiscal]
    if (!orderId) continue
    const current = latestByOrder[orderId]
    if (!current || (ev.dataStatus && ev.dataStatus > (current.dataStatus ?? ''))) {
      latestByOrder[orderId] = ev
    }
  }

  let updated = 0
  for (const [orderId, ev] of Object.entries(latestByOrder)) {
    const { error } = await svc
      .schema('marketplace')
      .from('orders')
      .update({
        tracking_code:      ev.awb || null,
        tracking_status:    String(ev.codStatus),
        tracking_desc:      ev.descStatus,
        tracking_date:      ev.dataStatus ? new Date(ev.dataStatus).toISOString() : null,
        tracking_updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
    if (!error) updated++
  }

  return NextResponse.json({
    updated,
    total_events: events.length,
    matched: Object.keys(latestByOrder).length,
  })
}
