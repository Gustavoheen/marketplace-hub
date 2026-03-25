import { createServiceClient } from '@/lib/supabase/service'

// Busca todos os tenants a que o usuário tem acesso
export async function getUserTenants(userId: string) {
  const supabase = createServiceClient()

  // Via memberships (multi-tenant)
  const { data: memberships } = await supabase
    .schema('marketplace')
    .from('user_tenant_memberships')
    .select('role, tenants:tenant_id(id, name, slug, plan)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (memberships?.length) {
    return memberships.map((m: any) => ({ role: m.role, ...m.tenants }))
  }

  // Fallback legacy: users.tenant_id
  const { data: user } = await supabase
    .schema('marketplace')
    .from('users')
    .select('role, tenant:tenant_id(id, name, slug, plan)')
    .eq('id', userId)
    .single()

  if (!user?.tenant) return []
  return [{ role: user.role, ...(user.tenant as any) }]
}

export async function getUserWithTenant(userId: string) {
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .schema('marketplace')
    .from('users')
    .select('*, tenant:tenants(*)')
    .eq('id', userId)
    .single()

  if (!user) return null

  return {
    user: {
      id: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      name: user.name,
      email: user.email,
      createdAt: new Date(user.created_at),
    },
    tenant: {
      id: (user.tenant as any).id,
      name: (user.tenant as any).name,
      slug: (user.tenant as any).slug,
      taxRegime: (user.tenant as any).tax_regime ?? null,
      effectiveTaxRate: (user.tenant as any).effective_tax_rate ?? null,
      createdAt: new Date((user.tenant as any).created_at),
      updatedAt: new Date((user.tenant as any).updated_at),
    },
  }
}

export async function createTenant(data: { name: string; slug: string }) {
  const supabase = createServiceClient()

  const { data: tenant, error } = await supabase
    .schema('marketplace')
    .from('tenants')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return tenant
}

export async function createUser(data: {
  id: string
  tenantId: string
  name: string
  email: string
  role?: string
}) {
  const supabase = createServiceClient()

  const { data: user, error } = await supabase
    .schema('marketplace')
    .from('users')
    .insert({
      id: data.id,
      tenant_id: data.tenantId,
      name: data.name,
      email: data.email,
      role: data.role ?? 'admin',
    })
    .select()
    .single()

  if (error) throw error
  return user
}
