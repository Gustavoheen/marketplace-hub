import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { blingExchangeCode } from '@/lib/integrations/bling'
import { upsertConnection } from '@/lib/db/queries/connections'
import { getUserWithTenant } from '@/lib/db/queries/tenants'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Erros vindos do Bling
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

  // Verificar autenticação
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.redirect(new URL('/login', request.url))

  const result = await getUserWithTenant(authUser.id)
  if (!result) return NextResponse.redirect(new URL('/login', request.url))

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
    const redirectUri = `${appUrl}/api/integracoes/bling/callback`

    const tokens = await blingExchangeCode(code, redirectUri)

    await upsertConnection({
      tenantId: result.tenant.id,
      marketplace: 'bling',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    })

    const response = NextResponse.redirect(new URL('/conexoes?success=bling', request.url))
    response.cookies.delete('bling_oauth_state')
    return response
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao conectar Bling'
    console.error('[bling/callback]', msg)
    return NextResponse.redirect(new URL(`/conexoes?error=${encodeURIComponent(msg)}`, request.url))
  }
}
