'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, ShoppingCart, Package,
  Percent, Plug, AlertTriangle, ArrowUpRight, ArrowDownRight,
  RefreshCw, Filter,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface DashboardStats {
  kpis: {
    totalRevenue: number
    totalOrders: number
    avgMargin: number | null
    activeConnections: number
    revenueChange: number | null
    orderChange: number | null
  }
  trend: Array<{ date: string; revenue: number; orders: number }>
  channelMix: Array<{ name: string; value: number }>
  statusBreakdown: Array<{ status: string; count: number }>
  pendingAlerts: number
  products: { total: number; lowStock: number }
}

// ── Constants ─────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: '1A', value: '1y' },
]

const CHANNEL_COLORS = [
  'var(--cyan)',
  'var(--emerald)',
  '#818CF8',
  '#F59E0B',
  '#F472B6',
  '#34D399',
  '#60A5FA',
  '#A78BFA',
]

const MARKETPLACE_LABELS: Record<string, string> = {
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  bling: 'Bling',
  outros: 'Outros',
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}K`
  return `R$ ${n.toFixed(2)}`
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(Math.round(n))
}

function fmtDate(dateStr: string, period: string) {
  const d = new Date(dateStr + 'T00:00:00')
  if (period === '1y') return d.toLocaleDateString('pt-BR', { month: 'short' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, period }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-3 py-2 text-[12px]"
      style={{ background: '#0F1623', border: '1px solid var(--border)', color: '#E8EDF5' }}
    >
      <p className="mb-1 font-semibold" style={{ color: 'var(--muted-foreground)' }}>
        {fmtDate(label, period)}
      </p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'revenue' ? 'Receita' : 'Pedidos'}:{' '}
          <span className="font-bold">
            {p.name === 'revenue' ? fmt(p.value) : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div
      className="rounded-lg px-3 py-2 text-[12px]"
      style={{ background: '#0F1623', border: '1px solid var(--border)', color: '#E8EDF5' }}
    >
      <p style={{ color: d.payload.fill }}>{MARKETPLACE_LABELS[d.name] || d.name}</p>
      <p className="font-bold">{fmt(d.value)}</p>
    </div>
  )
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({
  label, value, change, sub, icon: Icon, color, glow, loading,
}: {
  label: string
  value: string
  change?: number | null
  sub?: string
  icon: React.ElementType
  color: string
  glow: string
  loading?: boolean
}) {
  const isPositive = change !== null && change !== undefined && change >= 0

  return (
    <div
      className="card-hover rounded-xl p-5 relative overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="absolute top-0 right-0 h-20 w-20 rounded-bl-full opacity-40" style={{ background: glow }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
          <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: glow }}>
            <Icon className="h-[14px] w-[14px]" style={{ color }} />
          </div>
        </div>
        {loading ? (
          <div className="shimmer h-7 w-28 rounded mb-2" />
        ) : (
          <p className="text-2xl font-bold" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>
            {value}
          </p>
        )}
        <div className="mt-1 flex items-center gap-1.5">
          {change !== null && change !== undefined && !loading && (
            <span
              className="flex items-center gap-0.5 text-[11px] font-semibold"
              style={{ color: isPositive ? 'var(--emerald)' : '#F87171' }}
            >
              {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(change).toFixed(1)}%
            </span>
          )}
          {sub && (
            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{sub}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-semibold" style={{ fontFamily: 'var(--font-syne)', color: '#E8EDF5' }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center">
      <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>{message}</p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function DashboardClient() {
  const [period, setPeriod] = useState('30d')
  const [marketplace, setMarketplace] = useState('all')

  const { data, isLoading, refetch, isFetching } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', period, marketplace],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/stats?period=${period}&marketplace=${marketplace}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 min
  })

  const kpis = data?.kpis
  const hasData = (data?.trend || []).some(t => t.revenue > 0)
  const hasChannelData = (data?.channelMix || []).length > 0

  // Reduce trend to sensible tick count for 1y
  const trendData = period === '1y'
    ? (data?.trend || []).filter((_, i) => i % 7 === 0)
    : (data?.trend || [])

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period selector */}
        <div
          className="flex items-center gap-1 rounded-lg p-1"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className="rounded-md px-3 py-1.5 text-[12px] font-medium transition-all"
              style={{
                background: period === p.value ? 'rgba(6,200,217,0.12)' : 'transparent',
                color: period === p.value ? 'var(--cyan)' : 'var(--muted-foreground)',
                border: period === p.value ? '1px solid rgba(6,200,217,0.25)' : '1px solid transparent',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Marketplace filter */}
        <div className="relative flex items-center gap-2">
          <Filter className="absolute left-2.5 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
          <select
            value={marketplace}
            onChange={e => setMarketplace(e.target.value)}
            className="rounded-lg pl-8 pr-3 py-1.5 text-[12px] appearance-none cursor-pointer"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: '#E8EDF5',
              outline: 'none',
            }}
          >
            <option value="all">Todos os canais</option>
            <option value="mercadolivre">Mercado Livre</option>
            <option value="shopee">Shopee</option>
            <option value="amazon">Amazon</option>
            <option value="bling">Bling</option>
          </select>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Receita Total"
          value={kpis ? fmt(kpis.totalRevenue) : 'R$ —'}
          change={kpis?.revenueChange}
          sub="vs período anterior"
          icon={TrendingUp}
          color="var(--cyan)"
          glow="rgba(6,200,217,0.12)"
          loading={isLoading}
        />
        <KpiCard
          label="Pedidos"
          value={kpis ? String(kpis.totalOrders) : '—'}
          change={kpis?.orderChange}
          sub="vs período anterior"
          icon={ShoppingCart}
          color="var(--emerald)"
          glow="rgba(16,212,138,0.12)"
          loading={isLoading}
        />
        <KpiCard
          label="Margem Média"
          value={kpis?.avgMargin != null ? `${kpis.avgMargin.toFixed(1)}%` : '—%'}
          sub="Após comissões e impostos"
          icon={Percent}
          color="#F59E0B"
          glow="rgba(245,158,11,0.12)"
          loading={isLoading}
        />
        <KpiCard
          label="Canais Ativos"
          value={kpis ? `${kpis.activeConnections} canal${kpis.activeConnections !== 1 ? 'is' : ''}` : '—'}
          sub={data?.pendingAlerts ? `${data.pendingAlerts} alerta(s) pendente(s)` : 'Sem alertas'}
          icon={Plug}
          color="#818CF8"
          glow="rgba(129,140,248,0.12)"
          loading={isLoading}
        />
      </div>

      {/* ── Revenue trend chart ── */}
      <Section title="Receita ao Longo do Tempo">
        {!hasData && !isLoading ? (
          <EmptyChart message="Conecte seus marketplaces para ver a evolução de receita." />
        ) : isLoading ? (
          <div className="shimmer h-52 rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={trendData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--cyan)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                tickFormatter={d => fmtDate(d, period)}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={fmtShort}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<CustomTooltip period={period} />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--cyan)"
                strokeWidth={2}
                fill="url(#revenueGrad)"
                dot={false}
                activeDot={{ r: 4, fill: 'var(--cyan)', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* ── Bottom row: channel mix + orders bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Channel Mix (Pie) */}
        <Section title="Mix de Canais">
          {!hasChannelData && !isLoading ? (
            <EmptyChart message="Nenhuma venda registrada ainda." />
          ) : isLoading ? (
            <div className="shimmer h-48 rounded-lg" />
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={data?.channelMix}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data?.channelMix.map((entry, i) => (
                      <Cell key={entry.name} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {data?.channelMix.map((ch, i) => {
                  const total = data.channelMix.reduce((s, c) => s + c.value, 0)
                  const pct = total > 0 ? ((ch.value / total) * 100).toFixed(1) : '0'
                  return (
                    <div key={ch.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ background: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }}
                        />
                        <span className="text-[11px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                          {MARKETPLACE_LABELS[ch.name] || ch.name}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: '#E8EDF5' }}>
                        {pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Section>

        {/* Orders bar chart */}
        <Section title="Volume de Pedidos por Dia">
          {!hasData && !isLoading ? (
            <EmptyChart message="Nenhum pedido registrado no período." />
          ) : isLoading ? (
            <div className="shimmer h-48 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trendData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={d => fmtDate(d, period)}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip content={<CustomTooltip period={period} />} />
                <Bar
                  dataKey="orders"
                  fill="var(--emerald)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                  fillOpacity={0.85}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* ── Status breakdown + product summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Order status */}
        <Section title="Status dos Pedidos">
          {!data?.statusBreakdown?.length && !isLoading ? (
            <EmptyChart message="Nenhum pedido no período." />
          ) : isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="shimmer h-6 rounded" />)}
            </div>
          ) : (
            <div className="space-y-2.5">
              {(data?.statusBreakdown || [])
                .sort((a, b) => b.count - a.count)
                .map(item => {
                  const total = data!.statusBreakdown.reduce((s, i) => s + i.count, 0)
                  const pct = total > 0 ? (item.count / total) * 100 : 0
                  const color = item.status.includes('pago') || item.status === 'delivered'
                    ? 'var(--emerald)'
                    : item.status.includes('cancel')
                    ? '#F87171'
                    : 'var(--cyan)'
                  return (
                    <div key={item.status}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span style={{ color: 'var(--muted-foreground)' }} className="capitalize">
                          {item.status}
                        </span>
                        <span style={{ color: '#E8EDF5' }} className="font-semibold">
                          {item.count}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </Section>

        {/* Products summary */}
        <Section title="Estoque de Produtos">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="shimmer h-14 rounded" />)}
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className="flex items-center justify-between rounded-lg p-3"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--sidebar-border)' }}
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" style={{ color: 'var(--cyan)' }} />
                  <span className="text-[13px]" style={{ color: '#E8EDF5' }}>Total de produtos</span>
                </div>
                <span className="font-bold text-[15px]" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>
                  {data?.products.total ?? '—'}
                </span>
              </div>
              <div
                className="flex items-center justify-between rounded-lg p-3"
                style={{
                  background: (data?.products.lowStock ?? 0) > 0 ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${(data?.products.lowStock ?? 0) > 0 ? 'rgba(248,113,113,0.2)' : 'var(--sidebar-border)'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" style={{ color: (data?.products.lowStock ?? 0) > 0 ? '#F87171' : 'var(--muted-foreground)' }} />
                  <span className="text-[13px]" style={{ color: '#E8EDF5' }}>Estoque baixo ({'<'} 5 un.)</span>
                </div>
                <span
                  className="font-bold text-[15px]"
                  style={{ color: (data?.products.lowStock ?? 0) > 0 ? '#F87171' : '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}
                >
                  {data?.products.lowStock ?? '—'}
                </span>
              </div>
              <a
                href="/produtos"
                className="flex items-center justify-between rounded-lg p-3 transition-opacity hover:opacity-80"
                style={{ background: 'rgba(6,200,217,0.06)', border: '1px solid rgba(6,200,217,0.15)' }}
              >
                <span className="text-[13px] font-medium" style={{ color: 'var(--cyan)' }}>Ver todos os produtos</span>
                <ArrowUpRight className="h-4 w-4" style={{ color: 'var(--cyan)' }} />
              </a>
            </div>
          )}
        </Section>
      </div>

    </div>
  )
}
