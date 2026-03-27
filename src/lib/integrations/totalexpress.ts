// Total Express REST API — Previsão de entrega e ocorrência
// Endpoint: https://edi.totalexpress.com.br/previsao_entrega_atualizada.php
// Auth: HTTP Basic Auth (credenciais do portal ICS)

const ENDPOINT = 'https://edi.totalexpress.com.br/previsao_entrega_atualizada.php'

function getCredentials() {
  const login = process.env.TOTALEXPRESS_LOGIN
  const senha = process.env.TOTALEXPRESS_PASSWORD
  const remetenteId = process.env.TOTALEXPRESS_REMETENTE_ID
  if (!login || !senha) throw new Error('TOTALEXPRESS_LOGIN / TOTALEXPRESS_PASSWORD não configurados')
  if (!remetenteId) throw new Error('TOTALEXPRESS_REMETENTE_ID não configurado')
  return { login, senha, remetenteId }
}

// ── Status codes ──────────────────────────────────────────────────────────────

export const TE_STATUS: Record<number, string> = {
  0:   'Arquivo recebido',
  1:   'Entrega realizada',
  6:   'Endereço não localizado',
  8:   'Ausente/fechado (2x)',
  9:   'Recusada — mercadoria em desacordo',
  11:  'Recusada — avaria',
  12:  'Serviço não atendido',
  14:  'Mercadoria avariada',
  21:  'Cliente ausente / fechado',
  25:  'Devolução em andamento ao CD',
  26:  'Devolução recebida no CD',
  29:  'Cliente retira na transportadora',
  38:  'Redespachado Correios',
  39:  'Destinatário mudou-se',
  40:  'Cancelado pelo destinatário',
  56:  'Cancelado pelo remetente',
  60:  'RMA executado',
  61:  'Devolvida ao remetente',
  68:  'Coleta recebida no CD',
  70:  'Aviso de entrega',
  71:  'Devolução em andamento para remetente',
  80:  'Em agendamento',
  83:  'Coleta realizada',
  91:  'Entrega programada',
  101: 'Recebida e processada no CD',
  102: 'Em transferência',
  103: 'Recebido CD',
  104: 'Em processo de entrega',
  106: 'Redespacho transportadora',
}

export type TeTrackingEvent = {
  awb: string
  pedido: string
  notaFiscal: string
  codStatus: number
  descStatus: string
  dataStatus: string
  prevEntrega?: string
  prevEntregaAtualizada?: string
}

// ── Parse REST response ───────────────────────────────────────────────────────

type TeRestItem = {
  pedido?: unknown
  id_cliente?: unknown
  awb?: unknown
  nfiscal?: unknown
  detalhes?: {
    dataPrev?: { PrevEntrega?: string; PrevEntregaAtualizada?: string }
    statusDeEncomenda?: Array<{ statusid?: unknown; statusId?: unknown; status?: unknown; data?: unknown }>
  }
}

function parseRestResponse(raw: unknown): TeTrackingEvent[] {
  const events: TeTrackingEvent[] = []

  // Normaliza para array — pode vir como array, como { data: [...] }, ou como objeto único
  let items: TeRestItem[]
  if (Array.isArray(raw)) {
    items = raw
  } else if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    if (Array.isArray(r.data)) {
      items = r.data as TeRestItem[]
    } else if (r.pedido !== undefined || r.awb !== undefined) {
      items = [r as TeRestItem]
    } else {
      return []
    }
  } else {
    return []
  }

  for (const item of items) {
    const awb = String(item.awb || '')
    const pedido = String(item.pedido || '')
    const notaFiscal = String(item.nfiscal || '')
    const prevEntrega = item.detalhes?.dataPrev?.PrevEntrega
    const prevEntregaAtualizada = item.detalhes?.dataPrev?.PrevEntregaAtualizada

    const statusList = item.detalhes?.statusDeEncomenda
    if (Array.isArray(statusList) && statusList.length > 0) {
      for (const st of statusList) {
        const codStatus = Number(st.statusid ?? st.statusId ?? 0)
        const descStatus = String(st.status || TE_STATUS[codStatus] || `Status ${codStatus}`)
        const dataStatus = String(st.data || '')
        events.push({ awb, pedido, notaFiscal, codStatus, descStatus, dataStatus, prevEntrega, prevEntregaAtualizada })
      }
    } else if (awb || pedido) {
      events.push({ awb, pedido, notaFiscal, codStatus: 0, descStatus: 'Arquivo recebido', dataStatus: '', prevEntrega, prevEntregaAtualizada })
    }
  }

  return events
}

// ── obterTracking ─────────────────────────────────────────────────────────────

/**
 * Busca eventos de tracking da Total Express via REST.
 * - Se informar data (YYYY-MM-DD), consulta somente aquele dia.
 * - Se não informar, consulta hoje.
 */
export async function obterTracking(dataConsulta?: string): Promise<TeTrackingEvent[]> {
  const { login, senha, remetenteId } = getCredentials()
  const auth = 'Basic ' + Buffer.from(`${login}:${senha}`).toString('base64')

  const queryDate = dataConsulta || new Date().toISOString().slice(0, 10)

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': auth,
    },
    body: JSON.stringify({
      remetenteId,
      data_inicial: queryDate,
      data_final: queryDate,
    }),
  })

  const data = await res.json().catch(() => ({})) as Record<string, unknown>

  // code: 0 = credenciais inválidas, code: 400 = erro de argumento/sistema
  if (data.code === 0 || data.code === 400) {
    throw new Error(`Total Express erro: ${String(data.data || data.message || JSON.stringify(data))}`)
  }

  if (!res.ok) {
    throw new Error(`Total Express HTTP ${res.status}: ${JSON.stringify(data).slice(0, 400)}`)
  }

  return parseRestResponse(data)
}

/**
 * Busca tracking de um pedido específico pelo número do pedido.
 */
export async function obterTrackingPorPedido(numeroPedido: string): Promise<TeTrackingEvent[]> {
  const { login, senha, remetenteId } = getCredentials()
  const auth = 'Basic ' + Buffer.from(`${login}:${senha}`).toString('base64')

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': auth,
    },
    body: JSON.stringify({ remetenteId, pedido: numeroPedido }),
  })

  const data = await res.json().catch(() => ({})) as Record<string, unknown>

  if (data.code === 0 || data.code === 400) {
    throw new Error(`Total Express erro: ${String(data.data || data.message || JSON.stringify(data))}`)
  }
  if (!res.ok) throw new Error(`Total Express HTTP ${res.status}`)

  return parseRestResponse(data)
}

/**
 * Busca tracking por AWB.
 */
export async function obterTrackingPorAwb(awb: string): Promise<TeTrackingEvent[]> {
  const { login, senha, remetenteId } = getCredentials()
  const auth = 'Basic ' + Buffer.from(`${login}:${senha}`).toString('base64')

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': auth,
    },
    body: JSON.stringify({ remetenteId, awb }),
  })

  const data = await res.json().catch(() => ({})) as Record<string, unknown>

  if (data.code === 0 || data.code === 400) {
    throw new Error(`Total Express erro: ${String(data.data || data.message || JSON.stringify(data))}`)
  }
  if (!res.ok) throw new Error(`Total Express HTTP ${res.status}`)

  return parseRestResponse(data)
}

// ── Extração de NF do raw_data do Bling ──────────────────────────────────────

export function extractNfFromBling(raw: unknown): { nf_number: string | null; nf_key: string | null } {
  if (!raw || typeof raw !== 'object') return { nf_number: null, nf_key: null }
  const p = raw as Record<string, unknown>

  // Bling v3 — campo notaFiscal direto
  const nf = (p.notaFiscal ?? p.nota ?? (p.data as any)?.notaFiscal) as any
  if (nf) {
    const numero = String(nf.numero ?? nf.number ?? '').trim() || null
    const chave = String(nf.chave ?? nf.chaveAcesso ?? nf.key ?? '').trim() || null
    if (numero || chave) return { nf_number: numero, nf_key: chave }
  }

  // Array notas/notasFiscais
  const arr = (p.notas ?? p.notasFiscais ?? p.notasfiscais) as any
  if (Array.isArray(arr) && arr.length > 0) {
    const first = arr[0]
    return {
      nf_number: String(first.numero ?? first.number ?? '').trim() || null,
      nf_key: String(first.chave ?? first.chaveAcesso ?? '').trim() || null,
    }
  }

  return { nf_number: null, nf_key: null }
}

// ── Cor do status para UI ─────────────────────────────────────────────────────

export function teStatusStyle(codStatus: number | null) {
  if (codStatus === null) return { bg: 'rgba(255,255,255,0.04)', color: 'var(--muted-foreground)' }
  if (codStatus === 1) return { bg: 'rgba(16,212,138,0.12)', color: '#10D48A' }   // entregue
  if (codStatus === 104 || codStatus === 91 || codStatus === 70)
    return { bg: 'rgba(6,200,217,0.12)', color: '#06C8D9' }                       // em entrega
  if (codStatus === 101 || codStatus === 102 || codStatus === 103 || codStatus === 83 || codStatus === 68)
    return { bg: 'rgba(129,140,248,0.12)', color: '#818CF8' }                     // em trânsito
  if (codStatus === 0)
    return { bg: 'rgba(245,158,11,0.10)', color: '#F59E0B' }                      // recebido
  if (codStatus >= 6 && codStatus <= 99 && codStatus !== 68 && codStatus !== 83)
    return { bg: 'rgba(248,113,113,0.12)', color: '#F87171' }                     // problema
  return { bg: 'rgba(255,255,255,0.04)', color: 'var(--muted-foreground)' }
}
