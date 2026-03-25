'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, RefreshCw, Package, ChevronLeft, ChevronRight,
  ArrowRight, Tag, Box,
} from 'lucide-react'
import Image from 'next/image'

type Product = {
  id: string
  bling_id: string
  sku: string | null
  name: string
  sale_price: number | null
  cost_price: number | null
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
            {products.map((product) => {
              const imgs = getImages(product.images)
              const hasImg = imgs.length > 0
              const margin = product.sale_price && product.cost_price
                ? ((product.sale_price - product.cost_price) / product.sale_price * 100).toFixed(1)
                : null

              return (
                <div
                  key={product.id}
                  className="card-hover rounded-xl overflow-hidden"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  {/* Imagem */}
                  <div
                    className="relative h-40 flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    {hasImg ? (
                      <img
                        src={imgs[0]}
                        alt={product.name}
                        className="h-full w-full object-contain p-2"
                        loading="lazy"
                      />
                    ) : (
                      <Box className="h-10 w-10" style={{ color: 'var(--sidebar-border)' }} />
                    )}
                    {product.status === 'inactive' && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(7,9,15,0.7)' }}>
                        <span className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Inativo</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <p className="text-[12px] font-medium line-clamp-2 leading-snug" style={{ color: '#E8EDF5' }}>
                      {product.name}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {product.sku && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-mono"
                          style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted-foreground)' }}
                        >
                          {product.sku}
                        </span>
                      )}
                      {product.category_bling && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] truncate"
                          style={{ background: 'rgba(129,140,248,0.08)', color: '#818CF8' }}
                        >
                          {product.category_bling}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p
                          className="text-[15px] font-bold"
                          style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}
                        >
                          {product.sale_price != null
                            ? `R$ ${Number(product.sale_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            : '—'
                          }
                        </p>
                        {margin && (
                          <p className="text-[10px]" style={{ color: Number(margin) > 20 ? 'var(--emerald)' : 'var(--amber)' }}>
                            margem {margin}%
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p
                          className="text-[13px] font-bold"
                          style={{ color: product.stock_total > 0 ? '#E8EDF5' : 'var(--rose)', fontFamily: 'var(--font-jetbrains-mono)' }}
                        >
                          {product.stock_total}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>estoque</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
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
