import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { getConnection, upsertConnection } from '@/lib/db/queries/connections'
import { blingGetTodosProdutos, blingRefreshToken } from '@/lib/integrations/bling'
import { bulkUpsertProducts } from '@/lib/db/queries/products'

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

  // Refresh token se próximo do vencimento (< 10 min)
  let accessToken = connection.accessToken
  if (connection.expiresAt.getTime() - Date.now() < 10 * 60 * 1000) {
    try {
      const fresh = await blingRefreshToken(connection.refreshToken)
      await upsertConnection({
        tenantId,
        marketplace: 'bling',
        accessToken: fresh.accessToken,
        refreshToken: fresh.refreshToken,
        expiresAt: fresh.expiresAt,
      })
      accessToken = fresh.accessToken
    } catch {
      return NextResponse.json({ error: 'Falha ao renovar token do Bling' }, { status: 400 })
    }
  }

  try {
    let synced = 0
    const produtos = await blingGetTodosProdutos(accessToken, (total, fase) => {
      synced = total
    })

    await bulkUpsertProducts(tenantId, produtos)

    return NextResponse.json({ success: true, synced: produtos.length })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro no sync'
    console.error('[bling/sync]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
