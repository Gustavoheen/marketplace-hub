import { db } from '../index'
import { tenants, users } from '../schema'
import { eq } from 'drizzle-orm'

export async function getTenantBySlug(slug: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)
  return tenant ?? null
}

export async function getTenantById(id: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
  return tenant ?? null
}

export async function getUserWithTenant(userId: string) {
  const [result] = await db
    .select({
      user: users,
      tenant: tenants,
    })
    .from(users)
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .where(eq(users.id, userId))
    .limit(1)
  return result ?? null
}

export async function createTenant(data: { name: string; slug: string }) {
  const [tenant] = await db.insert(tenants).values(data).returning()
  return tenant
}

export async function createUser(data: {
  id: string
  tenantId: string
  name: string
  email: string
  role?: 'admin' | 'analyst' | 'viewer'
}) {
  const [user] = await db.insert(users).values(data).returning()
  return user
}
