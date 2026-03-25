import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBlingAuthUrl } from '@/lib/integrations/bling'

export async function GET(request: NextRequest) {
  // Verificar autenticação
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
  const redirectUri = `${appUrl}/api/integracoes/bling/callback`

  const { url, state } = getBlingAuthUrl(redirectUri)

  const response = NextResponse.redirect(url)
  // Salvar state no cookie para validar no callback
  response.cookies.set('bling_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutos
    path: '/',
  })
  return response
}
