import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { getConnection } from '@/lib/db/queries/connections'
import { mlGetMeusItens } from '@/lib/integrations/mercadolivre'
import { decrypt } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  const { agentType } = await request.json()

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await getUserWithTenant(authUser.id)
  if (!result) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenantId = result.tenant.id
  const svc = createServiceClient()

  // Criar run record
  const { data: run } = await svc.schema('marketplace').from('agent_runs')
    .insert({ tenant_id: tenantId, agent_type: agentType, status: 'running' })
    .select().single()

  if (!run) return NextResponse.json({ error: 'Falha ao criar run' }, { status: 500 })

  try {
    let productsChecked = 0
    let alertsCreated = 0

    if (agentType === 'buybox_monitor') {
      // Verificar conexão ML
      const mlConn = await getConnection(tenantId, 'mercadolivre')
      if (!mlConn || mlConn.status !== 'active') {
        throw new Error('Mercado Livre não conectado')
      }

      const mlUserId = mlConn.metadata?.userId as string | undefined
      if (!mlUserId) throw new Error('User ID do ML não encontrado')

      // Buscar meus itens no ML
      const itemsData = await mlGetMeusItens(mlConn.accessToken, mlUserId)
      const itemIds: string[] = itemsData?.results || []
      productsChecked = itemIds.length

      // Para cada item, verificar buybox (ML catálogo)
      for (const itemId of itemIds.slice(0, 20)) { // limite de 20 por run manual
        try {
          const itemRes = await fetch(
            `https://api.mercadolibre.com/items/${itemId}`,
            { headers: { Authorization: `Bearer ${mlConn.accessToken}` } }
          )
          const item = await itemRes.json()

          // Verificar se está no catálogo e se está ganhando
          const catalogListing = item.catalog_listing
          const ourPrice = Number(item.price)
          const winner = item.catalog_winner
          const isWinner = winner?.item_id === itemId || !catalogListing

          // Salvar snapshot de buybox
          await svc.schema('marketplace').from('buybox_snapshots').insert({
            tenant_id: tenantId,
            marketplace: 'mercadolivre',
            item_id: itemId,
            is_winner: isWinner,
            our_price: ourPrice,
            winner_price: winner?.price || ourPrice,
          })

          // Criar alerta se perdendo buybox
          if (catalogListing && !isWinner && winner?.price) {
            const winnerPrice = Number(winner.price)
            const diff = ourPrice - winnerPrice
            const diffPct = (diff / ourPrice) * 100

            await svc.schema('marketplace').from('agent_alerts').insert({
              tenant_id: tenantId,
              alert_type: 'buybox_lost',
              severity: diffPct > 20 ? 'high' : diffPct > 10 ? 'medium' : 'low',
              marketplace: 'mercadolivre',
              title: `Buybox perdido: ${item.title?.slice(0, 50)}`,
              description: `Seu preço: R$ ${ourPrice.toFixed(2)} | Vencedor: R$ ${winnerPrice.toFixed(2)} (${diffPct.toFixed(1)}% acima)`,
              data: { itemId, ourPrice, winnerPrice, diffPct, title: item.title },
            })
            alertsCreated++
          }

          await new Promise((r) => setTimeout(r, 200)) // rate limit
        } catch {
          // ignorar erros por item individual
        }
      }
    }

    // Finalizar run
    await svc.schema('marketplace').from('agent_runs').update({
      status: 'completed',
      products_checked: productsChecked,
      alerts_created: alertsCreated,
      finished_at: new Date().toISOString(),
    }).eq('id', run.id)

    return NextResponse.json({ success: true, productsChecked, alertsCreated })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro no agente'
    await svc.schema('marketplace').from('agent_runs').update({
      status: 'failed',
      error: msg,
      finished_at: new Date().toISOString(),
    }).eq('id', run.id)

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
