'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  Search, Filter, ChevronLeft, ChevronRight,
  ShoppingBag, ExternalLink, TrendingUp,
} from 'lucide-react'

interface Order {
  id: string
  bling_id: string | null
  marketplace: string | null
  status: string | null
  total_amount: number | null
  items_count: number | null
  customer_name: string | null
  order_date: string | null
}

interface Props {
  orders: Order[]
  total: number
  page: number
  pageSize: number
  filters: { q?: string; status?: string; marketplace?: string }
  statusOptions: string[]
}

const MARKETPLACE_LABELS: Record<string, string> = {
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  bling: 'Bling',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'em aberto': { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
  'atendido': { bg: 'rgba(16,212,138,0.12)', color: 'var(--emerald)' },
  'cancelado': { bg: 'rgba(248,113,113,0.12)', color: '#F87171' },
  'em andamento': { bg: 'rgba(6,200,217,0.12)', color: 'var(--cyan)' },
}

function statusStyle(s: string | null) {
  if (!s) return { bg: 'rgba(255,255,255,0.05)', color: 'var(--muted-foreground)' }
  const key = s.toLowerCase()
  for (const [k, v] of Object.entries(STATUS_COLORS)) {
    if (key.includes(k)) return v
  }
  return { bg: 'rgba(129,140,248,0.12)', color: '#818CF8' }
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function PedidosClient({ orders, total, page, pageSize, filters, statusOptions }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(filters.q || '')

  const totalPages = Math.ceil(total / pageSize)

  function navigate(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams()
    const merged = { ...filters, ...params }
    Object.entries(merged).forEach(([k, v]) => { if (v) sp.set(k, v) })
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate({ q: search || undefined, page: '1' })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: total, color: 'var(--cyan)' },
          { label: 'Esta página', value: orders.length, color: 'var(--emerald)' },
          { label: 'Receita (página)', value: fmt(orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)), color: '#F59E0B', isText: true },
        ].map(item => (
          <div
            key={item.label}
            className="rounded-xl p-3 md:p-4"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <p className="text-[10px] md:text-[11px] font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {item.label}
            </p>
            <p className="text-base md:text-xl font-bold" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>
              {item.isText ? item.value : item.value.toLocaleString('pt-BR')}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full rounded-lg pl-8 pr-3 py-2 text-[13px]"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: '#E8EDF5',
              outline: 'none',
            }}
          />
        </form>

        <select
          value={filters.status || ''}
          onChange={e => navigate({ status: e.target.value || undefined, page: '1' })}
          className="rounded-lg px-3 py-2 text-[12px] appearance-none"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: filters.status ? '#E8EDF5' : 'var(--muted-foreground)', outline: 'none' }}
        >
          <option value="">Todos os status</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filters.marketplace || ''}
          onChange={e => navigate({ marketplace: e.target.value || undefined, page: '1' })}
          className="rounded-lg px-3 py-2 text-[12px] appearance-none"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: filters.marketplace ? '#E8EDF5' : 'var(--muted-foreground)', outline: 'none' }}
        >
          <option value="">Todos os canais</option>
          {Object.entries(MARKETPLACE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table / Cards */}
      {isPending ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="shimmer h-14 rounded-xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl py-16 gap-3"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <ShoppingBag className="h-10 w-10 opacity-20" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-[14px]" style={{ color: 'var(--muted-foreground)' }}>
            Nenhum pedido encontrado
          </p>
          <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            Conecte o Bling e clique em "Sync Bling" no dashboard
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {orders.map(order => {
              const st = statusStyle(order.status)
              return (
                <div
                  key={order.id}
                  className="rounded-xl p-4 space-y-2"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: '#E8EDF5' }}>
                        {order.customer_name || 'Cliente não informado'}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                        #{order.bling_id || order.id.slice(0, 8)} · {fmtDate(order.order_date)}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 capitalize"
                      style={{ background: st.bg, color: st.color }}
                    >
                      {order.status || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] rounded px-1.5 py-0.5" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted-foreground)' }}>
                        {MARKETPLACE_LABELS[order.marketplace || ''] || order.marketplace || '—'}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                        {order.items_count || 0} iten{order.items_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-[14px] font-bold" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {fmt(order.total_amount)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div
            className="hidden md:block rounded-xl overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Pedido', 'Cliente', 'Canal', 'Status', 'Itens', 'Total', 'Data'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order, i) => {
                  const st = statusStyle(order.status)
                  return (
                    <tr
                      key={order.id}
                      style={{ borderBottom: i < orders.length - 1 ? '1px solid var(--sidebar-border)' : 'none' }}
                    >
                      <td className="px-4 py-3 text-[12px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
                        #{order.bling_id || order.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-[13px] max-w-[160px] truncate" style={{ color: '#E8EDF5' }}>
                        {order.customer_name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] rounded px-2 py-1" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted-foreground)' }}>
                          {MARKETPLACE_LABELS[order.marketplace || ''] || order.marketplace || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize" style={{ background: st.bg, color: st.color }}>
                          {order.status || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-center" style={{ color: 'var(--muted-foreground)' }}>
                        {order.items_count || 0}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-bold font-mono" style={{ color: '#E8EDF5' }}>
                        {fmt(order.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                        {fmtDate(order.order_date)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => navigate({ page: String(page - 1) })}
              className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-30"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <ChevronLeft className="h-4 w-4" style={{ color: '#E8EDF5' }} />
            </button>
            <span className="px-3 text-[12px]" style={{ color: '#E8EDF5' }}>
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => navigate({ page: String(page + 1) })}
              className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-30"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <ChevronRight className="h-4 w-4" style={{ color: '#E8EDF5' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
