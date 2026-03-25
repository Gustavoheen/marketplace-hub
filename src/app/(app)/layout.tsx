import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserWithTenant, getUserTenants } from '@/lib/db/queries/tenants'
import { Sidebar } from '@/components/layout/sidebar'
import { TenantProvider } from '@/components/layout/tenant-provider'
import type { Tenant, TenantUser as User } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const [result, allTenants] = await Promise.all([
    getUserWithTenant(authUser.id),
    getUserTenants(authUser.id),
  ])

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

  const tenant = result.tenant as unknown as Tenant
  const user = result.user as unknown as User

  return (
    <TenantProvider tenant={tenant} user={user}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar allTenants={allTenants} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </TenantProvider>
  )
}
