import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { cookies } from 'next/headers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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
  const { cost_price, pricing_mode, markup_pct, fixed_profit, extra_cost } = body

  const update: Record<string, unknown> = {}
  if (cost_price   !== undefined) update.cost_price   = cost_price   === '' ? null : Number(cost_price)
  if (pricing_mode !== undefined) update.pricing_mode = pricing_mode
  if (markup_pct   !== undefined) update.markup_pct   = markup_pct   === '' ? null : Number(markup_pct)
  if (fixed_profit !== undefined) update.fixed_profit = fixed_profit === '' ? null : Number(fixed_profit)
  if (extra_cost   !== undefined) update.extra_cost   = extra_cost   === '' ? null : Number(extra_cost)

  const svc = createServiceClient()
  const { error } = await svc
    .schema('marketplace')
    .from('products')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
