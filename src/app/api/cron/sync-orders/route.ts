import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { blingGetTodosPedidos, blingGetPedidoDetalhe, blingRefreshToken, normalizarSituacao, buildLojaMarketplaceMap, detectMarketplaceByNumero } from '@/lib/integrations/bling'
import { extractNfFromBling } from '@/lib/integrations/totalexpress'
import { upsertConnection } from '@/lib/db/queries/connections'

export const maxDuration = 300

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

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

// Chamado pelo Vercel Cron a cada hora
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()

  // Todos os tenants com Bling conectado
  const { data: connections } = await svc
    .schema('marketplace')
    .from('marketplace_connections')
    .select('tenant_id, access_token, refresh_token, expires_at, metadata')
    .eq('marketplace', 'bling')
    .eq('status', 'active')

  if (!connections?.length) {
    return NextResponse.json({ message: 'Nenhum tenant com Bling conectado', processed: 0 })
  }

  const { decrypt } = await import('@/lib/encryption')
  let totalOrders = 0

  for (const conn of connections) {
    try {
      const tenantId = conn.tenant_id
      let accessToken = decrypt(conn.access_token)
      const refreshToken = decrypt(conn.refresh_token)
      const expiresAt = new Date(conn.expires_at)

      // Refresh se token expirando em < 10 min
      if (expiresAt.getTime() - Date.now() < 10 * 60 * 1000) {
        const fresh = await blingRefreshToken(refreshToken)
        await upsertConnection({
          tenantId,
          marketplace: 'bling',
          accessToken: fresh.accessToken,
          refreshToken: fresh.refreshToken,
          expiresAt: fresh.expiresAt,
          metadata: conn.metadata as Record<string, unknown>,
        })
        accessToken = fresh.accessToken
      }

      // Busca apenas últimos 3 dias para manter o cron rápido
      const dataInicial = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
      const [pedidos, lojaMap] = await Promise.all([
        blingGetTodosPedidos(accessToken, dataInicial),
        buildLojaMarketplaceMap(accessToken),
      ])
      if (!pedidos.length) continue

      // Upsert orders em batches de 50 — lista básica
      for (let i = 0; i < pedidos.length; i += 50) {
        const batch = pedidos.slice(i, i + 50).map((p: any) => mapBlingOrderRow(tenantId, p, lojaMap))
        await svc.schema('marketplace').from('orders').upsert(batch, { onConflict: 'tenant_id,bling_id' })
      }

      // Busca detalhe de cada pedido para enriquecer estado + frete
      // (o endpoint de lista não retorna enderecoEntrega nem totaisMarketplace)
      const PARALLEL = 3
      for (let i = 0; i < pedidos.length; i += PARALLEL) {
        const slice = pedidos.slice(i, i + PARALLEL)
        await Promise.allSettled(slice.map(async (p: any) => {
          try {
            const detail = await blingGetPedidoDetalhe(accessToken, p.id)
            const { customer_state, shipping_cost, marketplace_fee } = extractFromDetail(detail)
            const updates: Record<string, unknown> = {}
            if (customer_state) updates.customer_state = customer_state
            if (shipping_cost) updates.shipping_cost = shipping_cost
            if (marketplace_fee) updates.marketplace_fee = marketplace_fee
            if (Object.keys(updates).length > 0) {
              await svc.schema('marketplace').from('orders')
                .update(updates)
                .eq('tenant_id', tenantId)
                .eq('bling_id', String(p.id))
            }
          } catch { /* ignora erros individuais */ }
        }))
        await sleep(600)
      }

      totalOrders += pedidos.length
    } catch (err) {
      console.error(`[cron/sync-orders] tenant ${conn.tenant_id}:`, err)
    }
  }

  return NextResponse.json({
    success: true,
    tenantsProcessed: connections.length,
    totalOrders,
  })
}

function mapBlingOrderRow(tenantId: string, p: any, lojaMap: Record<string, string> = {}) {
  const itemsDetail = Array.isArray(p.itens)
    ? p.itens.map((item: any) => ({
        sku: item.codigo || null,
        nome: item.descricao || null,
        quantidade: Number(item.quantidade || 1),
        valor: Number(item.valor || 0),
        total: Number(item.valor || 0) * Number(item.quantidade || 1),
      }))
    : []

  const customerState = p.enderecoEntrega?.uf || p.contato?.endereco?.uf || null
  const row: Record<string, unknown> = {
    tenant_id: tenantId,
    source: 'bling',
    bling_id: String(p.id),
    order_number: p.numero ? String(p.numero) : null,
    marketplace: lojaMap[String(p.loja?.id ?? '0')] ?? detectMarketplaceByNumero(String(p.loja?.id ?? '0'), p.numeroLoja ?? '') ?? p.canal_venda ?? 'bling',
    status: normalizarSituacao(p.situacao),
    total_amount: Number(p.total || 0),
    items_count: p.itens?.length || 0,
    items_detail: itemsDetail,
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
  // Não sobrescreve customer_state com null (preserva valor existente no DB)
  if (customerState) row.customer_state = customerState
  return row
}
