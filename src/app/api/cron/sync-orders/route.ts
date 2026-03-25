import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { blingGetTodosPedidos, blingRefreshToken } from '@/lib/integrations/bling'
import { upsertConnection } from '@/lib/db/queries/connections'

// Chamado pelo Vercel Cron a cada 2 horas
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

      const pedidos = await blingGetTodosPedidos(accessToken)
      if (!pedidos.length) continue

      // Upsert orders em batches de 50 — usando schema existente
      for (let i = 0; i < pedidos.length; i += 50) {
        const batch = pedidos.slice(i, i + 50).map((p: any) => mapBlingOrderRow(tenantId, p))

        await svc
          .schema('marketplace')
          .from('orders')
          .upsert(batch, { onConflict: 'tenant_id,bling_id' })
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

function mapBlingOrderRow(tenantId: string, p: any) {
  const itemsDetail = Array.isArray(p.itens)
    ? p.itens.map((item: any) => ({
        sku: item.codigo || null,
        nome: item.descricao || null,
        quantidade: Number(item.quantidade || 1),
        valor: Number(item.valor || 0),
        total: Number(item.valor || 0) * Number(item.quantidade || 1),
      }))
    : []

  return {
    tenant_id: tenantId,
    source: 'bling',
    bling_id: String(p.id),
    order_number: p.numero ? String(p.numero) : null,
    marketplace: p.canal_venda || 'bling',
    status: p.situacao?.value || 'unknown',
    total_amount: Number(p.total || 0),
    items_count: p.itens?.length || 0,
    items_detail: itemsDetail,
    customer_name: p.contato?.nome || null,
    customer_state: p.enderecoEntrega?.uf || p.contato?.endereco?.uf || null,
    shipping_carrier: p.transporte?.transportador?.nome || p.transporte?.transportadora?.nome || null,
    shipping_cost: Number(p.transporte?.frete || 0) || null,
    discount_total: Number(p.desconto?.valor || 0) || null,
    raw_data: p,
    order_date: p.data ? new Date(p.data).toISOString() : new Date().toISOString(),
    synced_at: new Date().toISOString(),
  }
}
