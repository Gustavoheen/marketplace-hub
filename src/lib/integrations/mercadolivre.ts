// Mercado Livre integration — portado de ml.js para TypeScript server-side

const ML_BASE = 'https://api.mercadolibre.com'

export type MLTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  userId: string
}

export function getMlAuthUrl(redirectUri: string): { url: string } {
  const clientId = process.env.ML_CLIENT_ID
  if (!clientId) throw new Error('ML_CLIENT_ID not set')
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
  })
  return { url: `https://auth.mercadolivre.com.br/authorization?${params}` }
}

async function mlOAuthRequest(body: Record<string, string>): Promise<MLTokens> {
  const clientId = process.env.ML_CLIENT_ID!
  const clientSecret = process.env.ML_CLIENT_SECRET!

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...body,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any
    throw new Error(err?.message || err?.error || `ML OAuth error ${res.status}`)
  }

  const data = await res.json() as any
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    userId: String(data.user_id),
  }
}

export async function mlExchangeCode(code: string, redirectUri: string): Promise<MLTokens> {
  return mlOAuthRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
}

export async function mlRefreshToken(refreshToken: string): Promise<MLTokens> {
  return mlOAuthRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

async function mlFetch<T = unknown>(endpoint: string, accessToken?: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  const res = await fetch(`${ML_BASE}${endpoint}`, { ...options, headers: { ...headers, ...(options.headers as Record<string, string> || {}) } })
  const data = await res.json() as any
  if (!res.ok) {
    const cause = Array.isArray(data?.cause) && data.cause.length > 0
      ? ' | ' + (data.cause as any[]).map((c: any) => c.message || c.code).join(', ')
      : ''
    throw new Error((data?.message || data?.error || `ML API error ${res.status}`) + cause)
  }
  return data as T
}

// ── Usuário ───────────────────────────────────────────────────────────────────

export async function mlGetMe(token: string): Promise<any> {
  return mlFetch('/users/me', token)
}

// ── Categorias (público) ──────────────────────────────────────────────────────

export async function mlBuscarCategorias(query: string, siteId = 'MLB'): Promise<any[]> {
  const data = await mlFetch<any>(`/sites/${siteId}/domain_discovery/search?q=${encodeURIComponent(query)}&limit=8`)
  return Array.isArray(data) ? data : []
}

export async function mlGetAtributosCategoria(categoryId: string): Promise<any[]> {
  const data = await mlFetch<any[]>(`/categories/${categoryId}/attributes`)
  return Array.isArray(data) ? data.filter((a: any) => a.tags?.required) : []
}

// ── Anúncios ──────────────────────────────────────────────────────────────────

export async function mlPublicarProduto(token: string, payload: unknown): Promise<any> {
  return mlFetch('/items', token, { method: 'POST', body: JSON.stringify(payload) })
}

export async function mlAtualizarProduto(token: string, itemId: string, payload: unknown): Promise<any> {
  return mlFetch(`/items/${itemId}`, token, { method: 'PUT', body: JSON.stringify(payload) })
}

export async function mlGetMeusItens(token: string, userId: string, offset = 0): Promise<any> {
  return mlFetch(`/users/${userId}/items/search?limit=100&offset=${offset}`, token)
}

export async function mlFecharItem(token: string, itemId: string): Promise<any> {
  return mlFetch(`/items/${itemId}`, token, { method: 'PUT', body: JSON.stringify({ status: 'closed' }) })
}

// ── Converter produto Bling → payload ML ─────────────────────────────────────

import type { BlingProduct } from './bling'

function stripHtml(html: string): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

export function blingParaMLPayload(
  produto: BlingProduct,
  categoryId: string,
  atributos: Array<{ id: string; valor?: string }> = [],
  config: { listingType?: string; condition?: string; catalogListing?: boolean } = {}
): object {
  const { listingType = 'gold_special', condition = 'new', catalogListing = false } = config

  const fotosSet = new Set<string>()
  const fotos: Array<{ source: string }> = []
  const addFoto = (url: string | null) => {
    if (url && url.startsWith('http') && !fotosSet.has(url)) {
      fotosSet.add(url)
      fotos.push({ source: url })
    }
  }
  if (produto.imagemURL) addFoto(produto.imagemURL)
  produto.imagens.forEach((img) => addFoto(img))

  const estoque = Number(produto.estoque?.saldoVirtualTotal || 0)
  const quantidade = listingType === 'free' ? 1 : Math.max(estoque, 1)

  const payload: Record<string, unknown> = {
    title: produto.nome,
    category_id: categoryId,
    price: produto.preco,
    currency_id: 'BRL',
    available_quantity: quantidade,
    buying_mode: 'buy_it_now',
    listing_type_id: listingType,
    condition,
    description: {
      plain_text: stripHtml(produto.descricaoComplementar) || stripHtml(produto.descricaoCurta) || produto.nome,
    },
    seller_custom_field: produto.codigo || undefined,
    pictures: fotos,
    attributes: atributos.map((a) => ({ id: a.id, value_name: a.valor || '' })).filter((a) => a.value_name),
    shipping: { mode: 'me2', free_shipping: false, local_pick_up: false },
  }

  if (!catalogListing) payload.catalog_listing = false
  return payload
}
