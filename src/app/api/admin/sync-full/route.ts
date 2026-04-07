import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { getConnection, upsertConnection } from '@/lib/db/queries/connections'
import { cookies } from 'next/headers'
import {
  blingGetTodosProdutos, blingGetTodosPedidos, blingGetPedidoDetalhe, blingRefreshToken,
  buildLojaMarketplaceMap, detectMarketplaceByNumero, normalizarSituacao,
} from '@/lib/integrations/bling'
import { bulkUpsertProducts } from '@/lib/db/queries/products'
import { extractNfFromBling, obterTracking } from '@/lib/integrations/totalexpress'

export const maxDuration = 300

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

/** Extrai UF e dados financeiros do detalhe do Bling.
 *  O estado fica em transporte.etiqueta.uf (endereço de entrega real).
 *  O frete fica em transporte.frete.
 */
function extractFromDetail(detail: any) {
  const d = detail?.data ?? detail ?? {}
  const uf = d?.transporte?.etiqueta?.uf
    || d?.enderecoEntrega?.uf
    || d?.contato?.endereco?.uf
    || null
  const shipping_cost = Number(d?.transporte?.frete || d?.totaisMarketplace?.custoFrete || 0) || null
  const marketplace_fee = Number(d?.totaisMarketplace?.taxaMarketplace || 0) || null
  return {
    customer_state: uf ? String(uf).toUpperCase().trim() : null,
    shipping_cost,
    marketplace_fee,
  }
}

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

  const svc = createServiceClient()
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

  const results: Record<string, unknown> = {}

  // ── 1. Produtos ─────────────────────────────────────────────────────────────
  try {
    const lista = await blingGetTodosProdutos(accessToken)
    await bulkUpsertProducts(tenantId!, lista)
    results.produtos = lista.length
  } catch (err: any) {
    results.produtosErro = err.message
  }

  // ── 2. Pedidos (lista rápida) ─────────────────────────────────────────────
  try {
    const [lista, lojaMap] = await Promise.all([
      blingGetTodosPedidos(accessToken),
      buildLojaMarketplaceMap(accessToken),
    ])

    for (let i = 0; i < lista.length; i += 50) {
      const batch = lista.slice(i, i + 50).map((p: any) => {
        const lojaId = String(p.loja?.id ?? '0')
        const marketplace = lojaMap[lojaId] ?? detectMarketplaceByNumero(lojaId, p.numeroLoja ?? '')
        const row: Record<string, unknown> = {
          tenant_id: tenantId!,
          bling_id: String(p.id),
          order_number: p.numero ? String(p.numero) : null,
          marketplace,
          status: normalizarSituacao(p.situacao),
          total_amount: Number(p.total || 0),
          customer_name: p.contato?.nome || null,
          ...extractNfFromBling(p),
          raw_data: p,
          order_date: p.data ? new Date(p.data).toISOString() : new Date().toISOString(),
          synced_at: new Date().toISOString(),
        }
        return row
      })
      await svc.schema('marketplace').from('orders')
        .upsert(batch, { onConflict: 'tenant_id,bling_id' })
    }
    results.pedidos = lista.length
  } catch (err: any) {
    results.pedidosErro = err.message
  }

  // ── 3. Tracking Total Express ────────────────────────────────────────────
  try {
    const today = new Date().toISOString().slice(0, 10)
    const events = await obterTracking(today)
    if (events?.length) {
      for (const ev of events) {
        if (!ev.notaFiscal && !ev.pedido) continue
        const { data: matched } = await svc.schema('marketplace').from('orders')
          .select('id')
          .eq('tenant_id', tenantId!)
          .or(`nf_number.eq.${ev.notaFiscal},order_number.eq.${ev.pedido}`)
          .limit(1).single()
        if (matched) {
          await svc.schema('marketplace').from('orders')
            .update({ tracking_code: ev.awb || null, tracking_status: ev.descStatus || null, tracking_updated_at: new Date().toISOString() })
            .eq('id', matched.id)
        }
      }
      results.tracking = events.length
    } else {
      results.tracking = 0
    }
  } catch (err: any) {
    results.trackingErro = err.message
  }

  // ── 4. Backfill: estado + frete via API de detalhe ───────────────────────
  // O endpoint de lista do Bling não retorna endereço nem totaisMarketplace.
  // Precisamos chamar o detalhe de cada pedido para obter esses dados.
  // Processa em lotes de 3 paralelos com 600ms de pausa (≈ 3 req/s).
  // Limite: 900 pedidos por rodada (~270s). Rode novamente para continuar.
  try {
    const { data: needsDetail } = await svc
      .schema('marketplace').from('orders')
      .select('id, bling_id')
      .eq('tenant_id', tenantId!)
      .or('customer_state.is.null,shipping_cost.is.null')
      .not('bling_id', 'is', null)
      .limit(900)

    let statesFixed = 0
    let freightFixed = 0
    const apiErrors: string[] = []

    const PARALLEL = 3
    const orders = needsDetail || []

    for (let i = 0; i < orders.length; i += PARALLEL) {
      const batch = orders.slice(i, i + PARALLEL)
      await Promise.allSettled(batch.map(async (order) => {
        try {
          const detail = await blingGetPedidoDetalhe(accessToken, order.bling_id!)
          const { customer_state, shipping_cost, marketplace_fee } = extractFromDetail(detail)

          const updates: Record<string, unknown> = {}
          if (customer_state) updates.customer_state = customer_state
          if (shipping_cost) updates.shipping_cost = shipping_cost
          if (marketplace_fee) updates.marketplace_fee = marketplace_fee

          if (Object.keys(updates).length > 0) {
            await svc.schema('marketplace').from('orders').update(updates).eq('id', order.id)
            if (customer_state) statesFixed++
            if (shipping_cost) freightFixed++
          }
        } catch (err: any) {
          if (apiErrors.length < 5) apiErrors.push(`${order.bling_id}: ${err.message}`)
        }
      }))
      await sleep(600)
    }

    results.detailProcessed = orders.length
    results.statesFixed = statesFixed
    results.freightFixed = freightFixed
    if (apiErrors.length) results.apiErrors = apiErrors

    // Quantos ainda faltam
    const { count: pending } = await svc
      .schema('marketplace').from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId!)
      .or('customer_state.is.null,shipping_cost.is.null')
      .not('bling_id', 'is', null)
    results.detailPending = pending ?? 0
  } catch (err: any) {
    results.detailErro = err.message
  }

  // ── 5. Corrigir status inválidos ─────────────────────────────────────────
  try {
    const { data: badStatus } = await svc
      .schema('marketplace').from('orders')
      .select('id, raw_data, status')
      .eq('tenant_id', tenantId!)
      .or('status.eq.unknown,status.is.null')
      .limit(5000)

    if (badStatus?.length) {
      let statusFixed = 0
      for (const o of badStatus) {
        const raw = (o as any).raw_data
        if (!raw) continue
        const situacao = raw?.situacao ?? raw?.data?.situacao
        const status = normalizarSituacao(situacao)
        if (status && status !== (o as any).status) {
          await svc.schema('marketplace').from('orders').update({ status }).eq('id', (o as any).id)
          statusFixed++
        }
      }
      if (statusFixed > 0) results.statusFixed = statusFixed
    }
  } catch (err: any) {
    results.statusErro = err.message
  }

  return NextResponse.json({ success: true, synced_at: new Date().toISOString(), ...results })
}
