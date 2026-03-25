'use client'

import { TenantContext } from '@/hooks/use-tenant'
import type { Tenant, TenantUser as User } from '@/types'

interface TenantProviderProps {
  tenant: Tenant
  user: User
  children: React.ReactNode
}

export function TenantProvider({ tenant, user, children }: TenantProviderProps) {
  return (
    <TenantContext.Provider value={{ tenant, user }}>
      {children}
    </TenantContext.Provider>
  )
}
