import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMlAuthUrl } from '@/lib/integrations/mercadolivre'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
  const redirectUri = `${appUrl}/api/integracoes/ml/callback`

  const { url } = getMlAuthUrl(redirectUri)
  return NextResponse.redirect(url)
}
