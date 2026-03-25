import { createServiceClient } from '@/lib/supabase/service'
import { encrypt, decrypt } from '@/lib/encryption'
import type { Marketplace, ConnectionStatus } from '@/types'

const TABLE = 'marketplace_connections'

// ── Upsert tokens (salva criptografado) ──────────────────────────────────────

export async function upsertConnection(params: {
  tenantId: string
  marketplace: Marketplace
  accessToken: string
  refreshToken: string
  expiresAt: Date
  metadata?: Record<string, unknown>
}) {
  const supabase = createServiceClient()

  const { error } = await supabase
    .schema('marketplace')
    .from(TABLE)
    .upsert(
      {
        tenant_id: params.tenantId,
        marketplace: params.marketplace,
        access_token: encrypt(params.accessToken),
        refresh_token: encrypt(params.refreshToken),
        expires_at: params.expiresAt.toISOString(),
        metadata: params.metadata || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,marketplace' }
    )

  if (error) throw new Error(`upsertConnection: ${error.message}`)
}

// ── Buscar conexão (retorna tokens descriptografados) ─────────────────────────

export async function getConnection(tenantId: string, marketplace: Marketplace): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
  metadata: Record<string, unknown> | null
  status: ConnectionStatus
} | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .schema('marketplace')
    .from(TABLE)
    .select('access_token, refresh_token, expires_at, metadata, status')
    .eq('tenant_id', tenantId)
    .eq('marketplace', marketplace)
    .single()

  if (error || !data) return null

  return {
    accessToken: decrypt(data.access_token),
    refreshToken: decrypt(data.refresh_token),
    expiresAt: new Date(data.expires_at),
    metadata: data.metadata as Record<string, unknown> | null,
    status: data.status as ConnectionStatus,
  }
}

// ── Listar todas as conexões de um tenant ────────────────────────────────────

export async function listConnections(tenantId: string): Promise<Array<{
  marketplace: Marketplace
  status: ConnectionStatus
  expiresAt: Date | null
  metadata: Record<string, unknown> | null
  updatedAt: Date
}>> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .schema('marketplace')
    .from(TABLE)
    .select('marketplace, status, expires_at, metadata, updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at')

  if (error) throw new Error(`listConnections: ${error.message}`)

  return (data || []).map((row: any) => ({
    marketplace: row.marketplace as Marketplace,
    status: row.status as ConnectionStatus,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    metadata: row.metadata as Record<string, unknown> | null,
    updatedAt: new Date(row.updated_at),
  }))
}

// ── Desconectar ───────────────────────────────────────────────────────────────

export async function disconnectMarketplace(tenantId: string, marketplace: Marketplace) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .schema('marketplace')
    .from(TABLE)
    .update({ status: 'disconnected', access_token: null, refresh_token: null, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('marketplace', marketplace)

  if (error) throw new Error(`disconnectMarketplace: ${error.message}`)
}
