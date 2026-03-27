import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { cookies } from 'next/headers'
import { normalizarSituacao } from '@/lib/integrations/bling'

export async function POST() {
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

  const svc = createServiceClient()

  // Busca pedidos com status incorreto (unknown, vazio, ou nulo)
  const { data: orders } = await svc
    .schema('marketplace')
    .from('orders')
    .select('id, raw_data, status')
    .eq('tenant_id', tenantId)
    .or('status.eq.unknown,status.is.null,status.eq.')
    .limit(5000)

  if (!orders?.length) {
    return NextResponse.json({ updated: 0, message: 'Nenhum pedido com status inválido' })
  }

  // Extrai o status correto do raw_data
  const updates = orders
    .map((o: any) => {
      const raw = o.raw_data
      if (!raw) return null
      const situacao = raw?.situacao ?? raw?.data?.situacao
      const status = normalizarSituacao(situacao)
      if (status === o.status) return null
      return { id: o.id, status }
    })
    .filter(Boolean) as { id: string; status: string }[]

  if (!updates.length) {
    return NextResponse.json({ updated: 0, message: 'Todos os status já estão corretos' })
  }

  // Atualiza em lotes de 100
  let updated = 0
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100)
    for (const u of batch) {
      await svc
        .schema('marketplace')
        .from('orders')
        .update({ status: u.status })
        .eq('id', u.id)
    }
    updated += batch.length
  }

  return NextResponse.json({ updated, total: orders.length })
}
