'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, ChevronLeft, ChevronRight, ShoppingBag, Package } from 'lucide-react'

interface Order {
  id: string
  bling_id: string | null
  order_number: string | null
  marketplace: string | null
  status: string | null
  total_amount: number | null
  customer_name: string | null
  customer_state: string | null
  order_date: string | null
  shipping_cost: number | null
  discount_total: number | null
}

interface Props {
  orders: Order[]
  total: number
  page: number
  pageSize: number
  filters: { q?: string; status?: string; marketplace?: string }
  period: string
  view: string
  statusOptions: string[]
  marketplaceOptions: string[]
  tabCounts: { todos: number; pendentes: number; atendidos: number; cancelados: number }
}

const PERIODS = [
  { label: '7 dias', value: '7d' },
  { label: '30 dias', value: '30d' },
  { label: '90 dias', value: '90d' },
  { label: '1 ano', value: '1y' },
  { label: 'Todos', value: 'all' },
]

const VIEWS = [
  { label: 'Todos', value: 'todos', color: 'var(--cyan)' },
  { label: 'Pendentes', value: 'pendentes', color: '#F59E0B' },
  { label: 'Atendidos', value: 'atendidos', color: 'var(--emerald)' },
  { label: 'Cancelados', value: 'cancelados', color: '#F87171' },
]

const MARKETPLACE_LABELS: Record<string, string> = {
  mercadolivre:   'Mercado Livre',
  shopee:         'Shopee',
  amazon:         'Amazon',
  magalu:         'Magalu',
  americanas:     'Americanas',
  madeiramadeira: 'Madeira Madeira',
  webcontinental: 'WebContinental',
  casas_bahia:    'Casas Bahia',
  shein:          'Shein',
  carrefour:      'Carrefour',
  kabum:          'KaBuM',
  netshoes:       'Netshoes',
  bling:          'Bling',
  outro:          'Outro',
}

const MARKETPLACE_COLORS: Record<string, { bg: string; color: string }> = {
  mercadolivre:   { bg: 'rgba(255,230,0,0.15)',   color: '#FFE600' },
  shopee:         { bg: 'rgba(238,77,45,0.15)',    color: '#EE4D2D' },
  amazon:         { bg: 'rgba(255,153,0,0.15)',    color: '#FF9900' },
  magalu:         { bg: 'rgba(0,134,255,0.15)',    color: '#0086FF' },
  americanas:     { bg: 'rgba(220,20,60,0.15)',    color: '#DC143C' },
  madeiramadeira: { bg: 'rgba(139,90,43,0.15)',    color: '#8B5A2B' },
  webcontinental: { bg: 'rgba(0,180,216,0.15)',    color: '#00B4D8' },
  casas_bahia:    { bg: 'rgba(0,100,200,0.15)',    color: '#0064C8' },
  shein:          { bg: 'rgba(255,0,128,0.15)',    color: '#FF0080' },
  bling:          { bg: 'rgba(232,121,58,0.15)',   color: '#E8793A' },
}

function marketplaceStyle(mp: string | null) {
  const key = (mp || '').toLowerCase().replace(/\s/g, '')
  return MARKETPLACE_COLORS[key] || { bg: 'rgba(255,255,255,0.07)', color: 'var(--muted-foreground)' }
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'em aberto':          { bg: 'rgba(245,158,11,0.12)',   color: '#F59E0B' },
  'atendido':           { bg: 'rgba(16,212,138,0.12)',   color: '#10D48A' },
  'cancelado':          { bg: 'rgba(248,113,113,0.12)',  color: '#F87171' },
  'em andamento':       { bg: 'rgba(6,200,217,0.12)',    color: '#06C8D9' },
  'aguardando':         { bg: 'rgba(129,140,248,0.12)',  color: '#818CF8' },
  'em producao':        { bg: 'rgba(249,115,22,0.12)',   color: '#F97316' },
  'enviado':            { bg: 'rgba(6,200,217,0.12)',    color: '#06C8D9' },
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
  if (n == null || n === 0) return '—'
  return `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function PedidosClient({
  orders, total, page, pageSize, filters, period, view,
  statusOptions, marketplaceOptions, tabCounts,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(filters.q || '')

  const totalPages = Math.ceil(total / pageSize)

  function navigate(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams()
    const merged = { period, view, ...filters, ...params }
    Object.entries(merged).forEach(([k, v]) => { if (v) sp.set(k, v) })
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate({ q: search || undefined, page: '1' })
  }

  const pageRevenue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 pb-24 md:pb-6">

      {/* ── Período ── */}
      <div className="flex items-center gap-1 flex-wrap">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => navigate({ period: p.value, page: '1' })}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all"
            style={{
              background: period === p.value ? 'rgba(6,200,217,0.12)' : 'var(--card)',
              border: period === p.value ? '1px solid rgba(6,200,217,0.3)' : '1px solid var(--border)',
              color: period === p.value ? 'var(--cyan)' : 'var(--muted-foreground)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Abas de status ── */}
      <div className="flex gap-2 flex-wrap">
        {VIEWS.map(v => (
          <button
            key={v.value}
            onClick={() => navigate({ view: v.value, page: '1' })}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold transition-all"
            style={{
              background: view === v.value ? `${v.color}15` : 'var(--card)',
              border: view === v.value ? `1px solid ${v.color}40` : '1px solid var(--border)',
              color: view === v.value ? v.color : 'var(--muted-foreground)',
            }}
          >
            {v.label}
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                background: view === v.value ? `${v.color}25` : 'rgba(255,255,255,0.06)',
                color: view === v.value ? v.color : 'var(--muted-foreground)',
              }}
            >
              {tabCounts[v.value as keyof typeof tabCounts].toLocaleString('pt-BR')}
            </span>
          </button>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-2">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full rounded-lg pl-8 pr-3 py-2 text-[13px]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: '#E8EDF5', outline: 'none' }}
          />
        </form>

        <select
          value={filters.marketplace || ''}
          onChange={e => navigate({ marketplace: e.target.value || undefined, page: '1' })}
          className="rounded-lg px-3 py-2 text-[12px] appearance-none"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: filters.marketplace ? '#E8EDF5' : 'var(--muted-foreground)', outline: 'none' }}
        >
          <option value="">Todos os canais</option>
          {marketplaceOptions.map(m => (
            <option key={m} value={m}>{MARKETPLACE_LABELS[m] || m}</option>
          ))}
        </select>

        {view === 'todos' && (
          <select
            value={filters.status || ''}
            onChange={e => navigate({ status: e.target.value || undefined, page: '1' })}
            className="rounded-lg px-3 py-2 text-[12px] appearance-none"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: filters.status ? '#E8EDF5' : 'var(--muted-foreground)', outline: 'none' }}
          >
            <option value="">Todos os status</option>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {/* ── Stats da página ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pedidos', value: total.toLocaleString('pt-BR'), color: 'var(--cyan)' },
          { label: 'Esta página', value: orders.length.toString(), color: 'var(--muted-foreground)' },
          { label: 'Receita (página)', value: `R$ ${pageRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: '#F59E0B' },
        ].map(item => (
          <div key={item.label} className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{item.label}</p>
            <p className="text-sm md:text-base font-bold truncate" style={{ color: item.color, fontFamily: 'var(--font-jetbrains-mono)' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* ── Lista ── */}
      {isPending ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <div key={i} className="shimmer h-14 rounded-xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl py-16 gap-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <ShoppingBag className="h-10 w-10 opacity-20" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-[14px]" style={{ color: 'var(--muted-foreground)' }}>Nenhum pedido encontrado</p>
          <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>Tente outro período ou filtro</p>
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {orders.map(order => {
              const st = statusStyle(order.status)
              return (
                <div key={order.id} className="rounded-xl p-4 space-y-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: '#E8EDF5' }}>
                        {order.customer_name || 'Cliente não informado'}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                        #{order.order_number || order.bling_id || order.id.slice(0, 8)} · {fmtDate(order.order_date)}
                        {order.customer_state ? ` · ${order.customer_state}` : ''}
                      </p>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 capitalize" style={{ background: st.bg, color: st.color }}>
                      {order.status || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold rounded px-2 py-0.5" style={marketplaceStyle(order.marketplace)}>
                      {MARKETPLACE_LABELS[(order.marketplace || '').toLowerCase()] || order.marketplace || '—'}
                    </span>
                    <span className="text-[14px] font-bold" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {fmt(order.total_amount)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop */}
          <div className="hidden md:block rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Pedido', 'Cliente', 'Estado', 'Canal', 'Status', 'Total', 'Data'].map(h => (
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
                    <tr key={order.id} style={{ borderBottom: i < orders.length - 1 ? '1px solid var(--sidebar-border)' : 'none' }}>
                      <td className="px-4 py-3 text-[12px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
                        #{order.order_number || order.bling_id || order.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-[13px] max-w-[150px] truncate" style={{ color: '#E8EDF5' }}>
                        {order.customer_name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {order.customer_state ? (
                          <span className="text-[11px] font-bold rounded px-1.5 py-0.5" style={{ background: 'rgba(6,200,217,0.1)', color: 'var(--cyan)' }}>
                            {order.customer_state}
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: 'var(--sidebar-border)' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-semibold rounded px-2 py-1" style={marketplaceStyle(order.marketplace)}>
                          {MARKETPLACE_LABELS[(order.marketplace || '').toLowerCase()] || order.marketplace || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize" style={{ background: st.bg, color: st.color }}>
                          {order.status || '—'}
                        </span>
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

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} de {total.toLocaleString('pt-BR')}
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
            <span className="px-3 text-[12px]" style={{ color: '#E8EDF5' }}>{page} / {totalPages}</span>
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
