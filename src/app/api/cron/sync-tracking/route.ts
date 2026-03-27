import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { obterTracking } from '@/lib/integrations/totalexpress'

// Chamado pelo Vercel Cron a cada 3 horas (30 */3 * * *)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  // Busca eventos de tracking de hoje na Total Express
  let events
  try {
    events = await obterTracking(today)
  } catch (err: any) {
    console.error('[cron/sync-tracking]', err.message)
    return NextResponse.json({ error: err.message }, { status: 502 })
  }

  if (!events.length) {
    return NextResponse.json({ updated: 0, message: 'Nenhum evento de tracking hoje' })
  }

  // Índices de busca a partir dos eventos
  const pedidoNums = [...new Set(events.map(e => e.pedido).filter(Boolean))]
  const nfNums     = [...new Set(events.map(e => e.notaFiscal).filter(Boolean))]

  if (!pedidoNums.length && !nfNums.length) {
    return NextResponse.json({ updated: 0, message: 'Nenhum pedido/NF nos eventos' })
  }

  // Busca pedidos de TODOS os tenants que batem com os eventos
  const orParts = [
    pedidoNums.length ? `order_number.in.(${pedidoNums.map(n => `"${n}"`).join(',')})` : null,
    nfNums.length     ? `nf_number.in.(${nfNums.map(n => `"${n}"`).join(',')})` : null,
    nfNums.length     ? `nf_assistencia.in.(${nfNums.map(n => `"${n}"`).join(',')})` : null,
  ].filter(Boolean).join(',')

  const { data: orders } = await svc
    .schema('marketplace')
    .from('orders')
    .select('id, order_number, nf_number, nf_assistencia')
    .or(orParts)

  if (!orders?.length) {
    return NextResponse.json({ updated: 0, message: 'Nenhum pedido correspondente' })
  }

  // Lookup por order_number, nf_number e nf_assistencia
  const byOrderNum: Record<string, string> = {}
  const byNfNum: Record<string, string> = {}
  const byNfAssistencia: Record<string, string> = {}
  for (const o of orders) {
    if (o.order_number)   byOrderNum[o.order_number] = o.id
    if (o.nf_number)      byNfNum[o.nf_number] = o.id
    if (o.nf_assistencia) byNfAssistencia[o.nf_assistencia] = o.id
  }

  // Pega o evento mais recente por pedido
  const latestByOrder: Record<string, typeof events[0]> = {}
  for (const ev of events) {
    const orderId =
      byOrderNum[ev.pedido] ??
      byNfNum[ev.notaFiscal] ??
      byNfAssistencia[ev.notaFiscal]
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
        tracking_code:       ev.awb || null,
        tracking_status:     String(ev.codStatus),
        tracking_desc:       ev.descStatus,
        tracking_date:       ev.dataStatus ? new Date(ev.dataStatus).toISOString() : null,
        tracking_updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
    if (!error) updated++
  }

  return NextResponse.json({
    success: true,
    total_events: events.length,
    matched: Object.keys(latestByOrder).length,
    updated,
  })
}
