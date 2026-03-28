import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { getConnection, upsertConnection } from '@/lib/db/queries/connections'
import { blingGetTodosProdutos, blingGetTodosPedidos, blingRefreshToken, buildLojaMarketplaceMap, detectMarketplaceByNumero, normalizarSituacao } from '@/lib/integrations/bling'
import { bulkUpsertProducts } from '@/lib/db/queries/products'
import { createServiceClient } from '@/lib/supabase/service'
import { extractNfFromBling } from '@/lib/integrations/totalexpress'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await getUserWithTenant(authUser.id)
  if (!result) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenantId = result.tenant.id
  const connection = await getConnection(tenantId, 'bling')
  if (!connection || connection.status !== 'active') {
    return NextResponse.json({ error: 'Bling não conectado' }, { status: 400 })
  }

  let accessToken = connection.accessToken

  // Refresh se necessário
  if (connection.expiresAt.getTime() - Date.now() < 10 * 60 * 1000) {
    const fresh = await blingRefreshToken(connection.refreshToken)
    await upsertConnection({
      tenantId,
      marketplace: 'bling',
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken,
      expiresAt: fresh.expiresAt,
    })
    accessToken = fresh.accessToken
  }

  const svc = createServiceClient()
  let produtos = 0
  let pedidos = 0
  const errors: string[] = []

  // ── Produtos ────────────────────────────────────────────────────────────
  try {
    const lista = await blingGetTodosProdutos(accessToken)
    await bulkUpsertProducts(tenantId, lista)
    produtos = lista.length
  } catch (err) {
    errors.push(`Produtos: ${err instanceof Error ? err.message : 'erro'}`)
  }

  // ── Pedidos ─────────────────────────────────────────────────────────────
  try {
    const [lista, lojaMap] = await Promise.all([
      blingGetTodosPedidos(accessToken),
      buildLojaMarketplaceMap(accessToken),
    ])
    if (lista.length) {
      for (let i = 0; i < lista.length; i += 50) {
        const batch = lista.slice(i, i + 50).map((p: any) => {
          const lojaId = String(p.loja?.id ?? '0')
          const numeroLoja = p.numeroLoja ?? ''
          const marketplace = lojaMap[lojaId] ?? detectMarketplaceByNumero(lojaId, numeroLoja)
          const customerState = p.enderecoEntrega?.uf || p.contato?.endereco?.uf || null
          const row: Record<string, unknown> = {
            tenant_id: tenantId,
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
          // Não sobrescreve customer_state com null (preserva valor existente no DB)
          if (customerState) row.customer_state = customerState
          return row
        })
        const { error: upsertErr } = await svc
          .schema('marketplace')
          .from('orders')
          .upsert(batch, { onConflict: 'tenant_id,bling_id' })
        if (upsertErr) errors.push(`Upsert batch ${i / 50 + 1}: ${upsertErr.message}`)
      }
      pedidos = lista.length
    }
  } catch (err) {
    errors.push(`Pedidos: ${err instanceof Error ? err.message : 'erro'}`)
  }

  return NextResponse.json({ success: true, produtos, pedidos, errors })
}
