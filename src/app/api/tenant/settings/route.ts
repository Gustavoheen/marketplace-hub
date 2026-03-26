import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { cookies } from 'next/headers'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cookieStore = await cookies()
  let tenantId = cookieStore.get('active_tenant_id')?.value
  if (!tenantId) {
    const result = await getUserWithTenant(user.id)
    if (!result) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
    tenantId = result.tenant.id
  }

  const body = await request.json()
  const { tax_regime, effective_tax_rate } = body

  const update: Record<string, unknown> = {}
  if (tax_regime !== undefined) update.tax_regime = tax_regime
  if (effective_tax_rate !== undefined) update.effective_tax_rate = effective_tax_rate === '' ? null : Number(effective_tax_rate)

  const svc = createServiceClient()
  const { error } = await svc
    .schema('marketplace')
    .from('tenants')
    .update(update)
    .eq('id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
