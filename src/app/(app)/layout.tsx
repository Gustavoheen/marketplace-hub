import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { Sidebar } from '@/components/layout/sidebar'
import { TenantProvider } from '@/components/layout/tenant-provider'
import type { Tenant, User } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const result = await getUserWithTenant(authUser.id)

  // Usuário autenticado mas sem tenant (pode acontecer em signup sem confirmação de email)
  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-8">
        <div>
          <h2 className="text-lg font-semibold">Configurando sua conta...</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Aguarde um momento ou recarregue a página.
          </p>
        </div>
      </div>
    )
  }

  const tenant: Tenant = {
    ...result.tenant,
    taxRegime: result.tenant.taxRegime ?? null,
    effectiveTaxRate: result.tenant.effectiveTaxRate ?? null,
  }

  const user: User = result.user

  return (
    <TenantProvider tenant={tenant} user={user}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </TenantProvider>
  )
}
