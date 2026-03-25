import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getConnection } from '@/lib/db/queries/connections'
import { mlGetMeusItens } from '@/lib/integrations/mercadolivre'
import { mlRefreshToken } from '@/lib/integrations/mercadolivre'
import { upsertConnection } from '@/lib/db/queries/connections'

// Chamado pelo Vercel Cron a cada 6 horas
export async function GET(request: NextRequest) {
  // Validar que veio do Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()

  // Buscar todos os tenants com ML conectado
  const { data: connections } = await svc
    .schema('marketplace')
    .from('marketplace_connections')
    .select('tenant_id, access_token, refresh_token, expires_at, metadata')
    .eq('marketplace', 'mercadolivre')
    .eq('status', 'active')

  if (!connections?.length) {
    return NextResponse.json({ message: 'Nenhum tenant com ML conectado', processed: 0 })
  }

  let totalAlerts = 0
  let totalProducts = 0

  for (const conn of connections) {
    try {
      const tenantId = conn.tenant_id
      const { decrypt } = await import('@/lib/encryption')
      let accessToken = decrypt(conn.access_token)
      const refreshToken = decrypt(conn.refresh_token)
      const expiresAt = new Date(conn.expires_at)

      // Refresh se necessário
      if (expiresAt.getTime() - Date.now() < 10 * 60 * 1000) {
        const fresh = await mlRefreshToken(refreshToken)
        await upsertConnection({
          tenantId,
          marketplace: 'mercadolivre',
          accessToken: fresh.accessToken,
          refreshToken: fresh.refreshToken,
          expiresAt: fresh.expiresAt,
          metadata: conn.metadata as Record<string, unknown>,
        })
        accessToken = fresh.accessToken
      }

      const userId = (conn.metadata as any)?.userId
      if (!userId) continue

      const itemsData = await mlGetMeusItens(accessToken, userId)
      const itemIds: string[] = itemsData?.results || []

      // Criar run record
      const { data: run } = await svc.schema('marketplace').from('agent_runs').insert({
        tenant_id: tenantId,
        agent_type: 'buybox_monitor',
        status: 'running',
      }).select().single()

      let alertsThisTenant = 0

      for (const itemId of itemIds.slice(0, 50)) {
        try {
          const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const item = await res.json()

          const catalogListing = item.catalog_listing
          const ourPrice = Number(item.price)
          const winner = item.catalog_winner
          const isWinner = !catalogListing || winner?.item_id === itemId

          await svc.schema('marketplace').from('buybox_snapshots').insert({
            tenant_id: tenantId,
            marketplace: 'mercadolivre',
            item_id: itemId,
            is_winner: isWinner,
            our_price: ourPrice,
            winner_price: winner?.price || ourPrice,
          })

          if (catalogListing && !isWinner && winner?.price) {
            const winnerPrice = Number(winner.price)
            const diff = ((ourPrice - winnerPrice) / ourPrice) * 100
            await svc.schema('marketplace').from('agent_alerts').insert({
              tenant_id: tenantId,
              alert_type: 'buybox_lost',
              severity: diff > 20 ? 'high' : diff > 10 ? 'medium' : 'low',
              marketplace: 'mercadolivre',
              title: `Buybox perdido: ${item.title?.slice(0, 50)}`,
              description: `Seu preço: R$ ${ourPrice.toFixed(2)} | Vencedor: R$ ${winnerPrice.toFixed(2)}`,
              data: { itemId, ourPrice, winnerPrice, diffPct: diff },
            })
            alertsThisTenant++
          }
          await new Promise((r) => setTimeout(r, 150))
        } catch { /* ignorar por item */ }
      }

      if (run) {
        await svc.schema('marketplace').from('agent_runs').update({
          status: 'completed',
          products_checked: itemIds.length,
          alerts_created: alertsThisTenant,
          finished_at: new Date().toISOString(),
        }).eq('id', run.id)
      }

      totalAlerts += alertsThisTenant
      totalProducts += itemIds.length
    } catch (err) {
      console.error(`[cron/buybox] tenant ${conn.tenant_id}:`, err)
    }
  }

  return NextResponse.json({
    success: true,
    tenantsProcessed: connections.length,
    totalProducts,
    totalAlerts,
  })
}
