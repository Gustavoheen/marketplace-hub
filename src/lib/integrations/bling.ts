// Bling ERP v3 integration — portado de bling.js para TypeScript server-side

const BASE_URL = 'https://www.bling.com.br/Api/v3'

export function getBlingAuthUrl(redirectUri: string): { url: string; state: string } {
  const clientId = process.env.BLING_CLIENT_ID
  if (!clientId) throw new Error('BLING_CLIENT_ID not set')
  const state = randomState()
  const params = new URLSearchParams({ response_type: 'code', client_id: clientId, state })
  return { url: `https://www.bling.com.br/Api/v3/oauth/authorize?${params}`, state }
}

function randomState(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export type BlingTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

async function blingOAuthRequest(body: Record<string, string>): Promise<BlingTokens> {
  const clientId = process.env.BLING_CLIENT_ID!
  const clientSecret = process.env.BLING_CLIENT_SECRET!
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams(body).toString(),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any
    throw new Error(err?.error?.description || err?.message || `Bling OAuth error ${res.status}`)
  }

  const data = await res.json() as any
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

export async function blingExchangeCode(code: string, redirectUri: string): Promise<BlingTokens> {
  return blingOAuthRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
}

export async function blingRefreshToken(refreshToken: string): Promise<BlingTokens> {
  return blingOAuthRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

async function blingFetch<T = unknown>(endpoint: string, accessToken: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  })
  const data = await res.json() as any
  if (!res.ok) throw new Error(data?.error?.description || data?.error || `Bling API error ${res.status}`)
  return data as T
}

// ── Normalização ─────────────────────────────────────────────────────────────

function strCampo(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    return String(obj.nome || obj.descricao || obj.name || '')
  }
  return String(val)
}

export type BlingProduct = {
  id: string
  nome: string
  codigo: string
  preco: number
  precoCusto: number
  situacao: string
  tipo: string
  unidade: string
  marca: string
  observacoes: string
  gtin: string
  descricaoCurta: string
  descricaoComplementar: string
  imagemURL: string | null
  imagens: string[]
  largura: number | null
  altura: number | null
  profundidade: number | null
  unidadeMedida: string
  peso: number | null
  pesoLiquido: number | null
  pesoBruto: number | null
  categoria: unknown
  estoque: { saldoVirtualTotal: number }
  tributacao: {
    ncm: string
    origemProduto: string
    percentualIpi: number
  }
  caracteristicas: unknown[]
  variacoes: unknown[]
  raw: unknown
}

export function normalizarProduto(raw: unknown): BlingProduct {
  const d = (raw as any)?.data || raw as any
  if (!d || typeof d !== 'object') return raw as BlingProduct

  const extrairUrl = (i: unknown): string | null => {
    if (!i) return null
    if (typeof i === 'string') return i
    const obj = i as Record<string, unknown>
    return (obj.link || obj.url || obj.linkMiniatura || obj.linkThumbnail) as string | null
  }

  const urlsSet = new Set<string>()
  const imagens: string[] = []
  const addImg = (i: unknown) => {
    const u = extrairUrl(i)
    if (u && !urlsSet.has(u)) { urlsSet.add(u); imagens.push(u) }
  }

  const midiaImgs = d.midia?.imagens
  if (midiaImgs && typeof midiaImgs === 'object' && !Array.isArray(midiaImgs)) {
    if (Array.isArray(midiaImgs.externas)) midiaImgs.externas.forEach(addImg)
    if (Array.isArray(midiaImgs.internas)) midiaImgs.internas.forEach(addImg)
    if (Array.isArray(midiaImgs.imagensURL)) midiaImgs.imagensURL.forEach(addImg)
  } else if (Array.isArray(midiaImgs)) {
    midiaImgs.forEach(addImg)
  }
  if (Array.isArray(d.imagens)) d.imagens.forEach(addImg)
  if (d.imagemURL) addImg(d.imagemURL)

  const dim = d.dimensoes || {}
  const trib = d.tributacao || {}

  return {
    id: String(d.id),
    nome: d.nome || '',
    codigo: d.codigo || '',
    preco: Number(d.preco ?? 0),
    precoCusto: Number(d.precoCusto ?? 0),
    situacao: d.situacao || 'A',
    tipo: d.tipo || 'P',
    unidade: strCampo(d.unidade),
    marca: strCampo(d.marca),
    observacoes: d.observacoes || '',
    gtin: d.gtin || '',
    descricaoCurta: d.descricaoCurta || '',
    descricaoComplementar: d.descricaoComplementar || '',
    imagemURL: imagens[0] || null,
    imagens,
    largura: dim.largura ?? d.largura ?? null,
    altura: dim.altura ?? d.altura ?? null,
    profundidade: dim.profundidade ?? d.profundidade ?? null,
    unidadeMedida: dim.unidadeMedida || 'cm',
    peso: d.pesoLiquido ?? d.peso ?? null,
    pesoLiquido: d.pesoLiquido ?? null,
    pesoBruto: d.pesoBruto ?? null,
    categoria: d.categoria || null,
    estoque: d.estoque || { saldoVirtualTotal: 0 },
    tributacao: {
      ncm: trib.ncm || d.ncm || '',
      origemProduto: String(trib.origemProduto ?? d.origemProduto ?? '0'),
      percentualIpi: trib.percentualIpi ?? d.percentualIpi ?? 0,
    },
    caracteristicas: Array.isArray(d.caracteristicas) ? d.caracteristicas : [],
    variacoes: Array.isArray(d.variacoes) ? d.variacoes : [],
    raw: d,
  }
}

// ── Produtos ─────────────────────────────────────────────────────────────────

export async function blingGetProdutos(token: string, pagina = 1) {
  return blingFetch<any>(`/produtos?limit=100&pagina=${pagina}&situacao=A`, token)
}

export async function blingGetProdutoDetalhe(token: string, id: string) {
  return blingFetch<any>(`/produtos/${id}`, token)
}

export async function blingGetTodosProdutos(
  token: string,
  onProgress?: (total: number, fase: string) => void
): Promise<BlingProduct[]> {
  // 1ª passagem: lista resumos
  let pagina = 1
  let resumos: any[] = []
  while (true) {
    const data = await blingGetProdutos(token, pagina)
    const itens: any[] = data?.data || []
    resumos = [...resumos, ...itens]
    if (onProgress) onProgress(resumos.length, 'listando')
    if (itens.length < 100) break
    pagina++
    await sleep(300)
  }

  // 2ª passagem: detalhe em lotes de 5
  const completos: BlingProduct[] = []
  for (let i = 0; i < resumos.length; i += 5) {
    const lote = resumos.slice(i, i + 5)
    const detalhes = await Promise.allSettled(lote.map((p) => blingGetProdutoDetalhe(token, p.id)))
    detalhes.forEach((r, idx) => {
      if (r.status === 'fulfilled') completos.push(normalizarProduto(r.value))
      else completos.push(normalizarProduto(lote[idx]))
    })
    if (onProgress) onProgress(completos.length, 'detalhando')
    await sleep(200)
  }
  return completos
}

// ── Pedidos ───────────────────────────────────────────────────────────────────

export async function blingGetPedidos(token: string, params: Record<string, string | number> = {}) {
  const query = new URLSearchParams({ limite: '100', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) }).toString()
  return blingFetch<any>(`/pedidos/vendas?${query}`, token)
}

export async function blingGetPedidoDetalhe(token: string, id: string | number) {
  return blingFetch<any>(`/pedidos/vendas/${id}`, token)
}

export async function blingGetTodosPedidos(
  token: string,
  dataInicial?: string,
  dataFinal?: string,
  onProgress?: (total: number) => void
) {
  let pagina = 1
  let todos: any[] = []
  while (true) {
    const params: Record<string, string> = { pagina: String(pagina) }
    if (dataInicial) params.dataInicial = dataInicial
    if (dataFinal) params.dataFinal = dataFinal
    const data = await blingGetPedidos(token, params)
    const itens: any[] = data?.data || []
    todos = [...todos, ...itens]
    if (onProgress) onProgress(todos.length)
    if (itens.length < 100) break
    pagina++
    await sleep(250)
  }
  return todos
}

// ── Canais / Publicação ───────────────────────────────────────────────────────

export async function blingGetCanais(token: string) {
  return blingFetch<any>('/canais', token)
}

// ── Lojas (canais de venda conectados ao Bling) ───────────────────────────────

export async function blingGetLojas(token: string) {
  return blingFetch<any>('/lojas', token)
}

/** Busca todas as lojas do Bling e retorna um mapa { lojaId → slug do marketplace } */
export async function buildLojaMarketplaceMap(token: string): Promise<Record<string, string>> {
  try {
    const res = await blingGetLojas(token)
    const lojas: any[] = res?.data ?? []
    const map: Record<string, string> = {}
    for (const loja of lojas) {
      const id = String(loja.id)
      const nome: string = (loja.descricao || loja.nome || '').toLowerCase()
      if (nome.includes('mercado livre') || nome.includes('mercadolivre')) map[id] = 'mercadolivre'
      else if (nome.includes('shopee')) map[id] = 'shopee'
      else if (nome.includes('amazon')) map[id] = 'amazon'
      else if (nome.includes('magalu') || nome.includes('magazine')) map[id] = 'magalu'
      else if (nome.includes('americanas')) map[id] = 'americanas'
      else if (nome.includes('casas bahia') || nome.includes('casasbahia')) map[id] = 'casas_bahia'
      else if (nome.includes('shein')) map[id] = 'shein'
      else if (nome.includes('webcontinental') || nome.includes('web continental')) map[id] = 'webcontinental'
      else if (nome.includes('carrefour')) map[id] = 'carrefour'
      else if (nome.includes('kabum')) map[id] = 'kabum'
      else if (nome.includes('netshoes')) map[id] = 'netshoes'
      else if (nome.includes('madeira')) map[id] = 'madeiramadeira'
      else map[id] = nome.replace(/\s+/g, '_') || 'outro'
    }
    return map
  } catch {
    return {}
  }
}

/** Mapa fixo de loja IDs conhecidos → marketplace (complementa o /lojas dinâmico) */
const LOJA_ID_MAP: Record<string, string> = {
  '204325696': 'madeiramadeira',
  '204317869': 'magalu',
  '204643843': 'mercadolivre',
  '204664956': 'mercadolivre',
  '205290110': 'mercadolivre',
  '205947821': 'webcontinental',
}

/** Detecta o marketplace pelo loja.id fixo ou padrão do numeroLoja (fallback quando /lojas falha) */
export function detectMarketplaceByNumero(lojaId: string, numeroLoja: string): string {
  if (!lojaId || lojaId === '0' || !numeroLoja) return 'bling'
  if (LOJA_ID_MAP[lojaId]) return LOJA_ID_MAP[lojaId]
  if (/^2000\d{12}/.test(numeroLoja)) return 'mercadolivre'
  if (/^LU-/.test(numeroLoja)) return 'magalu'
  if (/^W001/.test(numeroLoja)) return 'webcontinental'
  return 'outro'
}

// ── Status / Situação ─────────────────────────────────────────────────────────

/**
 * Mapa de IDs de situação do Bling v3 (pedido de venda) → nome legível.
 * Cobre tanto IDs padrão quanto variações comuns observadas na API.
 */
export const BLING_STATUS_MAP: Record<number, string> = {
  0:  'em digitação',
  1:  'em aberto',
  2:  'em andamento',
  3:  'atendido',
  4:  'cancelado',
  5:  'em andamento',
  6:  'verificado',
  7:  'aguardando confirmação',
  8:  'aguardando pagamento',
  9:  'em produção',
  10: 'pronto para envio',
  11: 'enviado',
  12: 'entregue',
  13: 'devolvido',
  14: 'assistência',
  15: 'assistência faturada',
  16: 'assistência expedida',
  17: 'atendido',
  18: 'cancelado',
  19: 'em andamento',
  20: 'aguardando pagamento',
  21: 'em produção',
  22: 'assistência',
  23: 'assistência faturada',
  24: 'assistência expedida',
  25: 'pronto para retirada',
  26: 'entrega agendada',
}

/**
 * Extrai o status legível de um campo `situacao` do Bling.
 * Tenta o valor textual primeiro; cai no mapa de IDs como fallback.
 */
export function normalizarSituacao(situacao: unknown): string {
  if (!situacao) return 'em aberto'
  if (typeof situacao === 'string') return situacao.toLowerCase()
  if (typeof situacao === 'number') return BLING_STATUS_MAP[situacao] ?? 'em aberto'
  const s = situacao as Record<string, unknown>
  if (s.valor && typeof s.valor === 'string') return s.valor.toLowerCase()
  if (s.value && typeof s.value === 'string') return s.value.toLowerCase()
  if (s.nome  && typeof s.nome  === 'string') return s.nome.toLowerCase()
  const id = Number(s.id ?? s.codigo)
  if (!isNaN(id) && BLING_STATUS_MAP[id]) return BLING_STATUS_MAP[id]
  return 'em aberto'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
