import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mlExchangeCode } from '@/lib/integrations/mercadolivre'
import { upsertConnection } from '@/lib/db/queries/connections'
import { getUserWithTenant } from '@/lib/db/queries/tenants'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/conexoes?error=${encodeURIComponent(error)}`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/conexoes?error=missing_code', request.url))
  }

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.redirect(new URL('/login', request.url))

  const result = await getUserWithTenant(authUser.id)
  if (!result) return NextResponse.redirect(new URL('/login', request.url))

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
    const redirectUri = `${appUrl}/api/integracoes/ml/callback`

    const tokens = await mlExchangeCode(code, redirectUri)

    await upsertConnection({
      tenantId: result.tenant.id,
      marketplace: 'mercadolivre',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      metadata: { userId: tokens.userId },
    })

    const response = NextResponse.redirect(new URL('/conexoes?success=ml', request.url))
    return response
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao conectar ML'
    console.error('[ml/callback]', msg)
    return NextResponse.redirect(new URL(`/conexoes?error=${encodeURIComponent(msg)}`, request.url))
  }
}
