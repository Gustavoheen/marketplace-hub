import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'

// PATCH /api/agents/alerts — marcar alerta como lido
export async function PATCH(request: NextRequest) {
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await getUserWithTenant(authUser.id)
  if (!result) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const svc = createServiceClient()
  const { error } = await svc
    .schema('marketplace')
    .from('agent_alerts')
    .update({ is_read: true })
    .eq('id', id)
    .eq('tenant_id', result.tenant.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
