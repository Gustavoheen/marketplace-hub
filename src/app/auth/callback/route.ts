import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createTenant, createUser } from '@/lib/db/queries/tenants'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const user = data.user
      const userName = user.user_metadata?.name ?? user.email ?? 'Usuário'
      const tenantName = user.user_metadata?.tenant_name ?? userName

      // Cria tenant + user na primeira vez (signup)
      try {
        const slug = tenantName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        const tenant = await createTenant({ name: tenantName, slug: `${slug}-${Date.now()}` })
        await createUser({
          id: user.id,
          tenantId: tenant.id,
          name: userName,
          email: user.email!,
          role: 'admin',
        })
      } catch {
        // Usuário já existe — ignorar
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
