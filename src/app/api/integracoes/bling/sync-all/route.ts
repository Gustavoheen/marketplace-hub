import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { getConnection, upsertConnection } from '@/lib/db/queries/connections'
import { blingGetTodosProdutos, blingGetTodosPedidos, blingRefreshToken } from '@/lib/integrations/bling'
import { bulkUpsertProducts } from '@/lib/db/queries/products'
import { createServiceClient } from '@/lib/supabase/service'

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
    const lista = await blingGetTodosPedidos(accessToken)
    if (lista.length) {
      for (let i = 0; i < lista.length; i += 50) {
        const batch = lista.slice(i, i + 50).map((p: any) => ({
          tenant_id: tenantId,
          source: 'bling',
          bling_id: String(p.id),
          marketplace: p.canal_venda || 'bling',
          status: p.situacao?.value || 'unknown',
          total_amount: Number(p.total || 0),
          items_count: p.itens?.length || 0,
          customer_name: p.contato?.nome || null,
          raw_data: p,
          order_date: p.data ? new Date(p.data).toISOString() : new Date().toISOString(),
          synced_at: new Date().toISOString(),
        }))
        await svc
          .schema('marketplace')
          .from('orders')
          .upsert(batch, { onConflict: 'tenant_id,bling_id' })
      }
      pedidos = lista.length
    }
  } catch (err) {
    errors.push(`Pedidos: ${err instanceof Error ? err.message : 'erro'}`)
  }

  return NextResponse.json({ success: true, produtos, pedidos, errors })
}
