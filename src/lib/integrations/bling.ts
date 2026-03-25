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

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
