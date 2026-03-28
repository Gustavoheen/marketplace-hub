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

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function extractUF(detail: any): string | null {
  const uf = detail?.enderecoEntrega?.uf
    || detail?.data?.enderecoEntrega?.uf
    || detail?.contato?.endereco?.uf
    || detail?.data?.contato?.endereco?.uf
    || null
  return uf ? String(uf).toUpperCase().trim() : null
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

  // ── 1. Produtos ─────────────────────────────────────────────────────────
  try {
    const lista = await blingGetTodosProdutos(accessToken)
    await bulkUpsertProducts(tenantId!, lista)
    results.produtos = lista.length
  } catch (err: any) {
    results.produtosErro = err.message
  }

  // ── 2. Pedidos ──────────────────────────────────────────────────────────
  try {
    const [lista, lojaMap] = await Promise.all([
      blingGetTodosPedidos(accessToken),
      buildLojaMarketplaceMap(accessToken),
    ])

    for (let i = 0; i < lista.length; i += 50) {
      const batch = lista.slice(i, i + 50).map((p: any) => {
        const lojaId = String(p.loja?.id ?? '0')
        const marketplace = lojaMap[lojaId] ?? detectMarketplaceByNumero(lojaId, p.numeroLoja ?? '')
        const customerState = p.enderecoEntrega?.uf || p.contato?.endereco?.uf || null
        const row: Record<string, unknown> = {
          tenant_id: tenantId!,
          bling_id: String(p.id),
          order_number: p.numero ? String(p.numero) : null,
          marketplace,
          status: normalizarSituacao(p.situacao),
          total_amount: Number(p.total || 0),
          customer_name: p.contato?.nome || null,
          shipping_carrier: p.transporte?.transportador?.nome || p.transporte?.transportadora?.nome || null,
          shipping_cost: Number(p.totaisMarketplace?.custoFrete || p.transporte?.frete || 0) || null,
          marketplace_fee: Number(p.totaisMarketplace?.taxaMarketplace || 0) || null,
          discount_total: Number(p.desconto?.valor || 0) || null,
          ...extractNfFromBling(p),
          raw_data: p,
          order_date: p.data ? new Date(p.data).toISOString() : new Date().toISOString(),
          synced_at: new Date().toISOString(),
        }
        if (customerState) row.customer_state = customerState
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
          .limit(1)
          .single()
        if (matched) {
          await svc.schema('marketplace').from('orders')
            .update({
              tracking_code: ev.awb || null,
              tracking_status: ev.descStatus || null,
              tracking_updated_at: new Date().toISOString(),
            })
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

  // ── 4. Preencher customer_state dos pedidos sem estado ───────────────────
  try {
    const { data: ordersWithoutState } = await svc
      .schema('marketplace').from('orders')
      .select('id, bling_id')
      .eq('tenant_id', tenantId!)
      .is('customer_state', null)
      .not('bling_id', 'is', null)
      .limit(100)

    let statesUpdated = 0
    for (const order of ordersWithoutState || []) {
      try {
        const detail = await blingGetPedidoDetalhe(accessToken, order.bling_id!)
        const uf = extractUF(detail)
        if (uf) {
          await svc.schema('marketplace').from('orders')
            .update({ customer_state: uf })
            .eq('id', order.id)
          statesUpdated++
        }
        await sleep(120)
      } catch { /* continua */ }
    }
    results.statesUpdated = statesUpdated
    results.statesPending = Math.max(0, (ordersWithoutState?.length || 0) - statesUpdated)
  } catch (err: any) {
    results.statesErro = err.message
  }

  return NextResponse.json({ success: true, synced_at: new Date().toISOString(), ...results })
}
