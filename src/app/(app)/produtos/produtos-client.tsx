'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, RefreshCw, Package, ChevronLeft, ChevronRight,
  ArrowRight, Box, Pencil, Check, X, TrendingUp, TrendingDown,
} from 'lucide-react'

type Product = {
  id: string
  bling_id: string
  sku: string | null
  name: string
  sale_price: number | null
  cost_price: number | null
  pricing_mode: string | null
  markup_pct: number | null
  fixed_profit: number | null
  extra_cost: number | null
  stock_total: number
  brand: string | null
  category_bling: string | null
  images: string | null
  status: string
  synced_at: string | null
}

export function ProdutosClient({
  products,
  total,
  page,
  totalPages,
  search,
  blingConnected,
}: {
  products: Product[]
  total: number
  page: number
  totalPages: number
  search: string
  blingConnected: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [searchValue, setSearchValue] = useState(search)
  const [editingId, setEditingId] = useState<string | null>(null)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    startTransition(() => {
      router.push(`/produtos?q=${encodeURIComponent(searchValue)}`)
    })
  }

  async function handleSync() {
    setIsSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/integracoes/bling/sync', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSyncMsg(`${data.synced} produtos sincronizados`)
        startTransition(() => router.refresh())
      } else {
        setSyncMsg(`Erro: ${data.error}`)
      }
    } catch {
      setSyncMsg('Erro de conexão')
    } finally {
      setIsSyncing(false)
    }
  }

  function getImages(imagesJson: string | null): string[] {
    try {
      const parsed = JSON.parse(imagesJson || '[]')
      return Array.isArray(parsed) ? parsed.slice(0, 1) : []
    } catch {
      return []
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 max-w-sm">
          <div
            className="flex flex-1 items-center gap-2 rounded-lg px-3 py-1.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--sidebar-border)' }}
          >
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Buscar produto..."
              className="flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: '#E8EDF5' }}
            />
          </div>
        </form>

        <div className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
          <span style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>{total}</span> produtos
        </div>

        {syncMsg && (
          <span className="text-[12px]" style={{ color: 'var(--emerald)' }}>{syncMsg}</span>
        )}

        {blingConnected && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all disabled:opacity-60"
            style={{
              background: 'rgba(6,200,217,0.08)',
              border: '1px solid rgba(6,200,217,0.2)',
              color: 'var(--cyan)',
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Bling'}
          </button>
        )}
      </div>

      {/* Empty state */}
      {products.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ background: 'rgba(6,200,217,0.08)', border: '1px solid rgba(6,200,217,0.15)' }}
            >
              <Package className="h-7 w-7" style={{ color: 'var(--cyan)' }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#E8EDF5', fontFamily: 'var(--font-syne)' }}>
                {search ? 'Nenhum produto encontrado' : 'Nenhum produto ainda'}
              </p>
              <p className="text-[13px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                {blingConnected
                  ? 'Sincronize o Bling para importar seus produtos.'
                  : 'Conecte o Bling em Conexões para sincronizar seus produtos.'}
              </p>
            </div>
            {blingConnected ? (
              <button
                onClick={handleSync}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium"
                style={{ background: 'linear-gradient(135deg, #06C8D9 0%, #0891B2 100%)', color: '#07090F' }}
              >
                <RefreshCw className="h-4 w-4" />
                Sincronizar agora
              </button>
            ) : (
              <a
                href="/conexoes"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium"
                style={{ background: 'rgba(6,200,217,0.08)', border: '1px solid rgba(6,200,217,0.2)', color: 'var(--cyan)' }}
              >
                Ir para Conexões
                <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Product grid */}
      {products.length > 0 && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                images={getImages(product.images)}
                isEditing={editingId === product.id}
                onEditOpen={() => setEditingId(product.id)}
                onEditClose={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null)
                  startTransition(() => router.refresh())
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderTop: '1px solid var(--sidebar-border)' }}
        >
          <span className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={page > 1 ? `/produtos?q=${search}&page=${page - 1}` : '#'}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
              style={{
                background: page > 1 ? 'rgba(255,255,255,0.04)' : 'transparent',
                border: '1px solid var(--sidebar-border)',
                color: page > 1 ? '#E8EDF5' : 'var(--sidebar-border)',
                pointerEvents: page > 1 ? 'auto' : 'none',
              }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </a>
            <a
              href={page < totalPages ? `/produtos?q=${search}&page=${page + 1}` : '#'}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-all"
              style={{
                background: page < totalPages ? 'rgba(255,255,255,0.04)' : 'transparent',
                border: '1px solid var(--sidebar-border)',
                color: page < totalPages ? '#E8EDF5' : 'var(--sidebar-border)',
                pointerEvents: page < totalPages ? 'auto' : 'none',
              }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({
  product,
  images,
  isEditing,
  onEditOpen,
  onEditClose,
  onSaved,
}: {
  product: Product
  images: string[]
  isEditing: boolean
  onEditOpen: () => void
  onEditClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [costPrice, setCostPrice] = useState(String(product.cost_price ?? ''))
  const [pricingMode, setPricingMode] = useState(product.pricing_mode ?? 'markup')
  const [markupPct, setMarkupPct] = useState(String(product.markup_pct ?? ''))
  const [fixedProfit, setFixedProfit] = useState(String(product.fixed_profit ?? ''))
  const [extraCost, setExtraCost] = useState(String(product.extra_cost ?? ''))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) setTimeout(() => inputRef.current?.focus(), 50)
  }, [isEditing])

  const cost = Number(costPrice) || 0
  const sale = Number(product.sale_price) || 0
  const margin = sale > 0 && cost > 0
    ? ((sale - cost) / sale * 100)
    : null

  async function handleSave() {
    setSaving(true)
    try {
      await fetch(`/api/produtos/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_price: costPrice === '' ? null : Number(costPrice),
          pricing_mode: pricingMode,
          markup_pct: markupPct === '' ? null : Number(markupPct),
          fixed_profit: fixedProfit === '' ? null : Number(fixedProfit),
          extra_cost: extraCost === '' ? null : Number(extraCost),
        }),
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--card)',
        border: isEditing ? '1px solid rgba(6,200,217,0.4)' : '1px solid var(--border)',
        boxShadow: isEditing ? '0 0 16px rgba(6,200,217,0.08)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Imagem */}
      <div className="relative h-36 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
        {images.length > 0 ? (
          <img src={images[0]} alt={product.name} className="h-full w-full object-contain p-2" loading="lazy" />
        ) : (
          <Box className="h-10 w-10" style={{ color: 'var(--sidebar-border)' }} />
        )}
        {product.status === 'inactive' && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(7,9,15,0.7)' }}>
            <span className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Inativo</span>
          </div>
        )}
        {/* Edit button */}
        {!isEditing && (
          <button
            onClick={onEditOpen}
            className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(6,200,217,0.15)', border: '1px solid rgba(6,200,217,0.3)' }}
            title="Editar custo"
          >
            <Pencil className="h-3 w-3" style={{ color: 'var(--cyan)' }} />
          </button>
        )}
      </div>

      {/* Info principal */}
      <div className="p-3 space-y-2">
        <p className="text-[12px] font-medium line-clamp-2 leading-snug" style={{ color: '#E8EDF5' }}>
          {product.name}
        </p>
        <div className="flex items-center gap-1.5">
          {product.sku && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-mono" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted-foreground)' }}>
              {product.sku}
            </span>
          )}
          {product.category_bling && (
            <span className="rounded px-1.5 py-0.5 text-[10px] truncate" style={{ background: 'rgba(129,140,248,0.08)', color: '#818CF8' }}>
              {product.category_bling}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-bold" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>
              {product.sale_price != null
                ? `R$ ${Number(product.sale_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : '—'
              }
            </p>
            {margin != null && (
              <div className="flex items-center gap-0.5">
                {margin >= 20
                  ? <TrendingUp className="h-3 w-3" style={{ color: 'var(--emerald)' }} />
                  : <TrendingDown className="h-3 w-3" style={{ color: margin > 0 ? 'var(--amber)' : 'var(--rose)' }} />
                }
                <p className="text-[10px]" style={{ color: margin >= 20 ? 'var(--emerald)' : margin > 0 ? 'var(--amber)' : 'var(--rose)' }}>
                  margem {margin.toFixed(1)}%
                </p>
              </div>
            )}
            {product.cost_price != null && margin == null && (
              <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                custo R$ {Number(product.cost_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[13px] font-bold"
              style={{ color: product.stock_total > 0 ? '#E8EDF5' : 'var(--rose)', fontFamily: 'var(--font-jetbrains-mono)' }}>
              {product.stock_total}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>estoque</p>
          </div>
        </div>

        {/* Botão de editar custo (visível sempre quando não editando) */}
        {!isEditing && (
          <button
            onClick={onEditOpen}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition-all"
            style={{
              background: product.cost_price != null ? 'rgba(16,212,138,0.06)' : 'rgba(6,200,217,0.06)',
              border: product.cost_price != null ? '1px solid rgba(16,212,138,0.2)' : '1px solid rgba(6,200,217,0.2)',
              color: product.cost_price != null ? 'var(--emerald)' : 'var(--cyan)',
            }}
          >
            <Pencil className="h-3 w-3" />
            {product.cost_price != null ? 'Editar custo' : 'Cadastrar custo'}
          </button>
        )}
      </div>

      {/* Painel de edição inline */}
      {isEditing && (
        <div
          className="px-3 pb-3 space-y-3"
          style={{ borderTop: '1px solid rgba(6,200,217,0.15)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest pt-3" style={{ color: 'var(--cyan)' }}>
            Configurar custo
          </p>

          {/* Custo */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Custo do produto (R$)</label>
            <div className="flex items-center gap-1 rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--sidebar-border)' }}>
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>R$</span>
              <input
                ref={inputRef}
                type="number" min="0" step="0.01"
                value={costPrice}
                onChange={e => setCostPrice(e.target.value)}
                className="flex-1 bg-transparent text-[12px] font-mono outline-none"
                style={{ color: '#E8EDF5' }}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Modo de precificação */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Modo</label>
            <div className="flex gap-1.5">
              {[{ v: 'markup', label: 'Markup %' }, { v: 'fixed', label: 'Lucro fixo' }].map(m => (
                <button
                  key={m.v}
                  onClick={() => setPricingMode(m.v)}
                  className="flex-1 rounded-md py-1 text-[10px] font-medium transition-all"
                  style={{
                    background: pricingMode === m.v ? 'rgba(6,200,217,0.12)' : 'rgba(255,255,255,0.03)',
                    border: pricingMode === m.v ? '1px solid rgba(6,200,217,0.3)' : '1px solid var(--sidebar-border)',
                    color: pricingMode === m.v ? 'var(--cyan)' : 'var(--muted-foreground)',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Markup % ou Lucro fixo */}
          {pricingMode === 'markup' ? (
            <div className="space-y-1">
              <label className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Markup desejado (%)</label>
              <div className="flex items-center gap-1 rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--sidebar-border)' }}>
                <input
                  type="number" min="0" step="0.5"
                  value={markupPct}
                  onChange={e => setMarkupPct(e.target.value)}
                  className="flex-1 bg-transparent text-[12px] font-mono outline-none"
                  style={{ color: '#E8EDF5' }}
                  placeholder="20"
                />
                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>%</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Lucro fixo por unidade (R$)</label>
              <div className="flex items-center gap-1 rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--sidebar-border)' }}>
                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>R$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={fixedProfit}
                  onChange={e => setFixedProfit(e.target.value)}
                  className="flex-1 bg-transparent text-[12px] font-mono outline-none"
                  style={{ color: '#E8EDF5' }}
                  placeholder="0,00"
                />
              </div>
            </div>
          )}

          {/* Custo extra (embalagem, etc) */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Custo extra / embalagem (R$)</label>
            <div className="flex items-center gap-1 rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--sidebar-border)' }}>
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>R$</span>
              <input
                type="number" min="0" step="0.01"
                value={extraCost}
                onChange={e => setExtraCost(e.target.value)}
                className="flex-1 bg-transparent text-[12px] font-mono outline-none"
                style={{ color: '#E8EDF5' }}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Preview de margem */}
          {Number(costPrice) > 0 && Number(product.sale_price) > 0 && (
            <div
              className="flex items-center justify-between rounded-lg px-2.5 py-2"
              style={{ background: 'rgba(16,212,138,0.06)', border: '1px solid rgba(16,212,138,0.15)' }}
            >
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Margem bruta atual</span>
              <span className="text-[11px] font-bold font-mono" style={{ color: 'var(--emerald)' }}>
                {((Number(product.sale_price) - Number(costPrice) - Number(extraCost || 0)) / Number(product.sale_price) * 100).toFixed(1)}%
              </span>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onEditClose}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--sidebar-border)', color: 'var(--muted-foreground)' }}
            >
              <X className="h-3 w-3" /> Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium disabled:opacity-60"
              style={{ background: 'rgba(6,200,217,0.12)', border: '1px solid rgba(6,200,217,0.3)', color: 'var(--cyan)' }}
            >
              <Check className="h-3 w-3" /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
