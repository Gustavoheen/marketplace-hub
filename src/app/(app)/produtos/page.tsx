import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { listProducts } from '@/lib/db/queries/products'
import { getConnection } from '@/lib/db/queries/connections'
import { Header } from '@/components/layout/header'
import { ProdutosClient } from './produtos-client'

export const metadata = {
  title: 'Produtos — Marketplace Hub',
}

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const search = params.q || ''
  const page = Math.max(1, Number(params.page || 1))
  const limit = 50
  const offset = (page - 1) * limit

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const result = await getUserWithTenant(authUser.id)
  if (!result) redirect('/login')

  const tenantId = result.tenant.id

  const [{ products, total }, blingConn] = await Promise.all([
    listProducts(tenantId, { limit, offset, search }),
    getConnection(tenantId, 'bling'),
  ])

  const blingConnected = blingConn?.status === 'active'
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="flex flex-col h-full">
      <Header title="Produtos" description="Catálogo sincronizado do Bling" />
      <ProdutosClient
        products={products}
        total={total}
        page={page}
        totalPages={totalPages}
        search={search}
        blingConnected={blingConnected}
      />
    </div>
  )
}
