import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { Header } from '@/components/layout/header'
import { ConfiguracoesClient } from './configuracoes-client'
import { cookies } from 'next/headers'

export const metadata = { title: 'Configurações — Marketplace Hub' }

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const cookieStore = await cookies()
  let tenantId = cookieStore.get('active_tenant_id')?.value
  let tenant: any = null

  if (tenantId) {
    const svc = createServiceClient()
    const { data } = await svc.schema('marketplace').from('tenants').select('*').eq('id', tenantId).single()
    tenant = data
  } else {
    const result = await getUserWithTenant(authUser.id)
    if (!result) redirect('/login')
    tenantId = result.tenant.id
    tenant = result.tenant
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Configurações" description="Regime tributário e parâmetros financeiros" />
      <ConfiguracoesClient tenant={tenant} />
    </div>
  )
}
