import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserTenants } from '@/lib/db/queries/tenants'

export async function POST(request: NextRequest) {
  const { tenantId } = await request.json()
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verificar que o usuário tem acesso a este tenant
  const tenants = await getUserTenants(user.id)
  const haAccess = tenants.some((t) => t.id === tenantId)
  if (!haAccess) return NextResponse.json({ error: 'Sem acesso a este tenant' }, { status: 403 })

  // Salvar tenant ativo em cookie
  const response = NextResponse.json({ success: true })
  response.cookies.set('active_tenant_id', tenantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  })

  return response
}
