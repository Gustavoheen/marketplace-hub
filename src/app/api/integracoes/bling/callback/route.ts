import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { blingExchangeCode, blingGetTodosProdutos, blingGetTodosPedidos } from '@/lib/integrations/bling'
import { upsertConnection } from '@/lib/db/queries/connections'
import { bulkUpsertProducts } from '@/lib/db/queries/products'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/conexoes?error=${encodeURIComponent(error)}`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/conexoes?error=missing_code', request.url))
  }

  // Validar state CSRF
  const savedState = request.cookies.get('bling_oauth_state')?.value
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL('/conexoes?error=invalid_state', request.url))
  }

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.redirect(new URL('/login', request.url))

  const result = await getUserWithTenant(authUser.id)
  if (!result) return NextResponse.redirect(new URL('/login', request.url))

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
    const redirectUri = `${appUrl}/api/integracoes/bling/callback`

    const tokens = await blingExchangeCode(code, redirectUri)
    const tenantId = result.tenant.id

    await upsertConnection({
      tenantId,
      marketplace: 'bling',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    })

    // ── Sync inicial em background (não bloqueia o redirect) ─────────────
    void syncBlingData(tenantId, tokens.accessToken)

    const response = NextResponse.redirect(new URL('/conexoes?success=bling', request.url))
    response.cookies.delete('bling_oauth_state')
    return response
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao conectar Bling'
    console.error('[bling/callback]', msg)
    return NextResponse.redirect(new URL(`/conexoes?error=${encodeURIComponent(msg)}`, request.url))
  }
}

async function syncBlingData(tenantId: string, accessToken: string) {
  const svc = createServiceClient()

  try {
    // Sync produtos
    const produtos = await blingGetTodosProdutos(accessToken)
    await bulkUpsertProducts(tenantId, produtos)
    console.log(`[bling/sync] ${produtos.length} produtos sincronizados para tenant ${tenantId}`)
  } catch (err) {
    console.error('[bling/sync] erro produtos:', err)
  }

  try {
    // Sync pedidos
    const pedidos = await blingGetTodosPedidos(accessToken)
    if (pedidos.length) {
      for (let i = 0; i < pedidos.length; i += 50) {
        const batch = pedidos.slice(i, i + 50).map((p: any) => ({
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
      console.log(`[bling/sync] ${pedidos.length} pedidos sincronizados para tenant ${tenantId}`)
    }
  } catch (err) {
    console.error('[bling/sync] erro pedidos:', err)
  }
}
