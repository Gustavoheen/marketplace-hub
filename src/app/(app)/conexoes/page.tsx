import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { listConnections } from '@/lib/db/queries/connections'
import { Header } from '@/components/layout/header'
import { ConexoesClient } from './conexoes-client'
import type { Marketplace } from '@/types'

export const metadata = {
  title: 'Conexões — Marketplace Hub',
}

type MarketplaceConfig = {
  mp: Marketplace
  color: string
  glow: string
  category: 'erp' | 'marketplace'
  priority?: boolean
}

export const MARKETPLACE_CONFIGS: MarketplaceConfig[] = [
  { mp: 'bling', color: '#06C8D9', glow: 'rgba(6,200,217,0.12)', category: 'erp', priority: true },
  { mp: 'mercadolivre', color: '#F59E0B', glow: 'rgba(245,158,11,0.12)', category: 'marketplace', priority: true },
  { mp: 'shopee', color: '#F97316', glow: 'rgba(249,115,22,0.12)', category: 'marketplace' },
  { mp: 'amazon', color: '#F59E0B', glow: 'rgba(245,158,11,0.12)', category: 'marketplace' },
  { mp: 'magalu', color: '#3B82F6', glow: 'rgba(59,130,246,0.12)', category: 'marketplace' },
  { mp: 'shein', color: '#EC4899', glow: 'rgba(236,72,153,0.12)', category: 'marketplace' },
  { mp: 'casas_bahia', color: '#10D48A', glow: 'rgba(16,212,138,0.12)', category: 'marketplace' },
  { mp: 'webcontinental', color: '#818CF8', glow: 'rgba(129,140,248,0.12)', category: 'marketplace' },
  { mp: 'madeiramadeira', color: '#A78BFA', glow: 'rgba(167,139,250,0.12)', category: 'marketplace' },
]

export default async function ConexoesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const params = await searchParams

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const result = await getUserWithTenant(authUser.id)
  if (!result) redirect('/login')

  const connections = await listConnections(result.tenant.id)

  // Mapear para objeto indexado por marketplace
  const connectionMap = Object.fromEntries(
    connections.map((c) => [c.marketplace, c])
  ) as Record<Marketplace, (typeof connections)[0] | undefined>

  const activeCount = connections.filter((c) => c.status === 'active').length

  return (
    <div className="flex flex-col h-full">
      <Header title="Conexões" description="ERPs e marketplaces" />
      <ConexoesClient
        configs={MARKETPLACE_CONFIGS}
        connectionMap={connectionMap}
        activeCount={activeCount}
        successParam={params.success}
        errorParam={params.error}
      />
    </div>
  )
}
