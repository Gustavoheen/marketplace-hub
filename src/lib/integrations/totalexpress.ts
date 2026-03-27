// Total Express WebService v2.4 — SOAP integration
// Endpoint: https://edi.totalexpress.com.br/webservice24.php
// Protocol: SOAP 1.1 + HTTP Basic Auth

const ENDPOINT = 'https://edi.totalexpress.com.br/webservice24.php'

function getCredentials() {
  const login = process.env.TOTALEXPRESS_LOGIN
  const senha = process.env.TOTALEXPRESS_PASSWORD
  if (!login || !senha) throw new Error('TOTALEXPRESS_LOGIN / TOTALEXPRESS_PASSWORD não configurados')
  return { login, senha }
}

function basicAuth(login: string, senha: string) {
  return 'Basic ' + Buffer.from(`${login}:${senha}`).toString('base64')
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
}

// ── ObterTracking ─────────────────────────────────────────────────────────────

function buildObterTrackingEnvelope(login: string, senha: string, dataConsulta?: string): string {
  const dateTag = dataConsulta
    ? `<DataConsulta xsi:type="xsd:date">${dataConsulta}</DataConsulta>`
    : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns1="urn:ObterTracking"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ns2="http://edi.totalexpress.com.br/soap/webservice_v24.total"
  xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
  SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <SOAP-ENV:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${login}</wsse:Username>
        <wsse:Password>${senha}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </SOAP-ENV:Header>
  <SOAP-ENV:Body>
    <ns1:ObterTracking>
      <ObterTrackingRequest xsi:type="ns2:ObterTrackingRequest">
        ${dateTag}
      </ObterTrackingRequest>
    </ns1:ObterTracking>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`
}

/** Busca eventos de tracking da Total Express. Se não informar data, retorna lotes pendentes. */
export async function obterTracking(dataConsulta?: string): Promise<TeTrackingEvent[]> {
  const { login, senha } = getCredentials()
  const body = buildObterTrackingEnvelope(login, senha, dataConsulta)

  // Tenta primeiro com WS-Security no envelope; fallback com HTTP Basic Auth
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      'SOAPAction': '',
      'Authorization': basicAuth(login, senha),
    },
    body,
  })

  const xml = await res.text()
  if (!res.ok) throw new Error(`Total Express HTTP ${res.status}: ${xml.slice(0, 300)}`)

  return parseObterTrackingResponse(xml)
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, 'i')
  return xml.match(re)?.[1]?.trim() ?? ''
}

function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, 'gi')
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim())
  return results
}

function parseObterTrackingResponse(xml: string): TeTrackingEvent[] {
  const codProc = Number(extractTag(xml, 'CodigoProc'))
  if (codProc !== 1) return [] // não processado ou sem dados

  const events: TeTrackingEvent[] = []
  const encomendas = extractAllTags(xml, 'EncomendaRetorno')

  for (const enc of encomendas) {
    const awb = extractTag(enc, 'AWB')
    const pedido = extractTag(enc, 'Pedido')
    const notaFiscal = extractTag(enc, 'NotaFiscal')
    const statusItems = extractAllTags(enc, 'StatusTotal')

    for (const st of statusItems) {
      const codStatus = Number(extractTag(st, 'CodStatus'))
      const descStatus = extractTag(st, 'DescStatus') || TE_STATUS[codStatus] || `Status ${codStatus}`
      const dataStatus = extractTag(st, 'DataStatus')
      events.push({ awb, pedido, notaFiscal, codStatus, descStatus, dataStatus })
    }

    // Se não houver StatusTotal, registra apenas o AWB recebido
    if (statusItems.length === 0 && awb) {
      events.push({ awb, pedido, notaFiscal, codStatus: 0, descStatus: 'Arquivo recebido', dataStatus: '' })
    }
  }

  return events
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
