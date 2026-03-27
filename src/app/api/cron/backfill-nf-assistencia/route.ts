import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { blingRefreshToken, blingGetPedidoDetalhe } from '@/lib/integrations/bling'
import { upsertConnection } from '@/lib/db/queries/connections'
import { decrypt } from '@/lib/encryption'

// Chamado pelo Vercel Cron a cada 4 horas (15 */4 * * *)
// Lê as ocorrências do Bling e preenche nf_assistencia automaticamente

const NF_PATTERNS = [
  /\bNF\s*:?\s*(\d+)/i,
  /\bnota\s*:?\s*(\d+)/i,
  /^\s*(\d+)\s*$/,
]

function extractNfAssistencia(detail: any): string | null {
  const ocorrencias: any[] =
    detail?.data?.ocorrencias ??
    detail?.ocorrencias ??
    []
  for (const oc of ocorrencias) {
    const textos = [oc?.observacoes, oc?.descricao, oc?.obs].filter(Boolean)
    for (const texto of textos) {
      const str = String(texto).trim()
      for (const pattern of NF_PATTERNS) {
        const match = str.match(pattern)
        if (match?.[1]) return match[1]
      }
    }
  }
  return null
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()

  // Todos os tenants com Bling conectado
  const { data: connections } = await svc
    .schema('marketplace')
    .from('marketplace_connections')
    .select('tenant_id, access_token, refresh_token, expires_at, metadata')
    .eq('marketplace', 'bling')
    .eq('status', 'active')

  if (!connections?.length) {
    return NextResponse.json({ message: 'Nenhum tenant com Bling', updated: 0 })
  }

  let totalUpdated = 0

  for (const conn of connections) {
    try {
      const tenantId = conn.tenant_id
      let accessToken = decrypt(conn.access_token)
      const refreshToken = decrypt(conn.refresh_token)
      const expiresAt = new Date(conn.expires_at)

      if (expiresAt.getTime() - Date.now() < 10 * 60 * 1000) {
        const fresh = await blingRefreshToken(refreshToken)
        await upsertConnection({
          tenantId,
          marketplace: 'bling',
          accessToken: fresh.accessToken,
          refreshToken: fresh.refreshToken,
          expiresAt: fresh.expiresAt,
          metadata: conn.metadata as Record<string, unknown>,
        })
        accessToken = fresh.accessToken
      }

      // Pedidos de assistência faturada sem nf_assistencia (máx 50 por execução por tenant)
      const { data: orders } = await svc
        .schema('marketplace').from('orders')
        .select('id, bling_id, order_number')
        .eq('tenant_id', tenantId)
        .is('nf_assistencia', null)
        .not('bling_id', 'is', null)
        .or('status.ilike.%assistência faturada%,status.ilike.%assistencia faturada%')
        .limit(50)

      if (!orders?.length) continue

      for (const order of orders) {
        try {
          const detail = await blingGetPedidoDetalhe(accessToken, order.bling_id!)
          const nfAssistencia = extractNfAssistencia(detail)
          if (nfAssistencia) {
            await svc
              .schema('marketplace').from('orders')
              .update({ nf_assistencia: nfAssistencia })
              .eq('id', order.id)
            totalUpdated++
          }
          await sleep(150)
        } catch { /* ignora erro individual */ }
      }
    } catch (err) {
      console.error(`[cron/backfill-nf-assistencia] tenant ${conn.tenant_id}:`, err)
    }
  }

  return NextResponse.json({ success: true, updated: totalUpdated })
}
