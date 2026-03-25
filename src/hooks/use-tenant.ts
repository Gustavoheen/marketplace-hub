'use client'

import { createContext, useContext } from 'react'
import type { Tenant, TenantUser as User } from '@/types'

interface TenantContextValue {
  tenant: Tenant
  user: User
}

export const TenantContext = createContext<TenantContextValue | null>(null)

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error('useTenant deve ser usado dentro de TenantProvider')
  }
  return ctx
}
