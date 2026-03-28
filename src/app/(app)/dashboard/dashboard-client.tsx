'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, ShoppingCart, Package,
  Percent, AlertTriangle, ArrowUpRight, ArrowDownRight,
  RefreshCw, Filter, Database, Wrench, MapPin, ExternalLink,
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
    estimatedProfit: number | null
    netProfitEstimate: number | null
    totalCommission: number
    totalShippingPaid: number
    totalTax: number
    taxRate: number
    taxRegime: string
    productsWithCost: number
    totalProducts: number
    assistenciaCount: number
  }
  trend: Array<{ date: string; revenue: number; orders: number; profit: number }>
  channelMix: Array<{ name: string; value: number; orders: number; commission: number; commissionRate: number }>
  statusBreakdown: Array<{ status: string; count: number }>
  geoBreakdown: Array<{ state: string; orders: number; revenue: number }>
  geoEnrichment: { withState: number; withoutState: number }
  pendingAlerts: number
  products: { total: number; lowStock: number; withCost: number }
  lastSync: { bling: string | null; tracking: string | null }
  recentOrders: Array<{
    orderNumber: string | null
    marketplace: string | null
    customerName: string | null
    customerState: string | null
    totalAmount: number
    status: string | null
    orderDate: string | null
  }>
}

// ── Constants ─────────────────────────────────────────────────────────────

const PERIODS = [
  { label: 'Hoje', value: '1d' },
  { label: 'Ontem', value: 'yesterday' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: '1A', value: '1y' },
]

const TAX_REGIMES = [
  { value: 'mei',              label: 'MEI',              rate: 0 },
  { value: 'simples_nacional', label: 'Simples Nacional', rate: 6 },
  { value: 'lucro_presumido',  label: 'Lucro Presumido',  rate: 11.33 },
  { value: 'lucro_real',       label: 'Lucro Real',       rate: 9.25 },
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
  outros:         'Outros',
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtSync(iso: string | null | undefined): string {
  if (!iso) return 'nunca'
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString()
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `hoje ${time}`
  if (isYesterday) return `ontem ${time}`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + time
}

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

const RECENT_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  entregue:   { bg: 'rgba(16,212,138,0.12)',  color: '#10D48A' },
  atendido:   { bg: 'rgba(16,212,138,0.12)',  color: '#10D48A' },
  enviado:    { bg: 'rgba(56,189,248,0.12)',  color: '#38BDF8' },
  cancelado:  { bg: 'rgba(248,113,113,0.12)', color: '#F87171' },
  devolvido:  { bg: 'rgba(239,68,68,0.12)',   color: '#EF4444' },
  assist:     { bg: 'rgba(168,85,247,0.12)',  color: '#A855F7' },
  pronto:     { bg: 'rgba(99,102,241,0.12)',  color: '#818CF8' },
  produc:     { bg: 'rgba(249,115,22,0.12)',  color: '#F97316' },
  andamento:  { bg: 'rgba(6,200,217,0.12)',   color: '#06C8D9' },
  pendente:   { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B' },
  aberto:     { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B' },
}

function recentStatusStyle(s: string | null) {
  if (!s) return { bg: 'rgba(255,255,255,0.05)', color: 'var(--muted-foreground)' }
  const key = s.toLowerCase()
  for (const [k, v] of Object.entries(RECENT_STATUS_COLORS)) {
    if (key.includes(k)) return v
  }
  return { bg: 'rgba(129,140,248,0.12)', color: '#818CF8' }
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
          {p.name === 'revenue' ? 'Receita' : p.name === 'profit' ? 'Lucro est.' : 'Pedidos'}:{' '}
          <span className="font-bold">
            {p.name === 'revenue' || p.name === 'profit' ? fmt(p.value) : p.value}
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
      className="card-hover rounded-xl p-4 md:p-5 relative overflow-hidden"
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
          <p className="text-lg md:text-2xl font-bold" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>
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

// ── Assistência Card ───────────────────────────────────────────────────────

function AssistenciaCard({ count, total, loading }: { count: number; total: number; loading?: boolean }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  const color = pct === 0 ? 'var(--emerald)' : pct < 2 ? '#F59E0B' : '#F87171'
  const glow = pct === 0 ? 'rgba(16,212,138,0.12)' : pct < 2 ? 'rgba(245,158,11,0.12)' : 'rgba(248,113,113,0.12)'

  return (
    <div
      className="rounded-xl p-4 md:p-5 flex items-center gap-5"
      style={{ background: 'var(--card)', border: `1px solid ${pct > 0 ? 'rgba(248,113,113,0.3)' : 'var(--border)'}` }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: glow }}>
        <Wrench className="h-5 w-5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
          Pedidos em Assistência
        </p>
        {loading ? (
          <div className="shimmer h-5 w-32 rounded" />
        ) : (
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-xl font-bold" style={{ color, fontFamily: 'var(--font-jetbrains-mono)' }}>
              {pct.toFixed(2)}%
            </span>
            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {count} {count === 1 ? 'pedido' : 'pedidos'} de {total.toLocaleString('pt-BR')} no período
            </span>
          </div>
        )}
        {!loading && (
          <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(pct * 5, 100)}%`, background: color }}
            />
          </div>
        )}
      </div>
      <a
        href="/pedidos?view=assistencia"
        className="shrink-0 text-xs font-medium hover:underline"
        style={{ color }}
      >
        Ver pedidos →
      </a>
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
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncingFull, setSyncingFull] = useState(false)
  const [savingTax, setSavingTax] = useState(false)
  const queryClient = useQueryClient()

  async function handleTaxRegimeChange(regime: string) {
    setSavingTax(true)
    await fetch('/api/tenant/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tax_regime: regime }),
    })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    setSavingTax(false)
  }

  async function handleSyncFull() {
    setSyncingFull(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/admin/sync-full', { method: 'POST' })
      const json = await res.json()
      if (json.error) {
        setSyncMsg(`Erro: ${json.error}`)
      } else {
        const parts = []
        if (json.produtos != null) parts.push(`${json.produtos} produtos`)
        if (json.pedidos != null) parts.push(`${json.pedidos} pedidos`)
        if (json.tracking != null) parts.push(`${json.tracking} rastreios`)
        if (json.statesUpdated != null) parts.push(`${json.statesUpdated} estados preenchidos`)
        if (json.produtosErro) parts.push(`Produtos: ${json.produtosErro}`)
        if (json.pedidosErro) parts.push(`Pedidos: ${json.pedidosErro}`)
        setSyncMsg(`✓ ${parts.join(' · ')}`)
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      }
    } catch {
      setSyncMsg('Erro ao conectar com o servidor')
    } finally {
      setSyncingFull(false)
      setTimeout(() => setSyncMsg(null), 8000)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/integracoes/bling/sync-all', { method: 'POST' })
      const json = await res.json()
      if (json.error) {
        setSyncMsg(`Erro: ${json.error}`)
      } else {
        setSyncMsg(`✓ ${json.produtos} produtos · ${json.pedidos} pedidos sincronizados`)
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      }
    } catch {
      setSyncMsg('Erro ao conectar com o servidor')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 6000)
    }
  }

  const { data, isLoading, refetch, isFetching } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', period, marketplace],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/stats?period=${period}&marketplace=${marketplace}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: true,
  })

  const kpis = data?.kpis
  const hasData = (data?.trend || []).some(t => t.revenue > 0)
  const hasChannelData = (data?.channelMix || []).length > 0

  // Reduce trend to sensible tick count for 1y
  const trendData = period === '1y'
    ? (data?.trend || []).filter((_, i) => i % 7 === 0)
    : (data?.trend || [])

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-5 pb-2">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
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
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: '#E8EDF5', outline: 'none' }}
          >
            <option value="all">Todos os canais</option>
            <option value="mercadolivre">Mercado Livre</option>
            <option value="shopee">Shopee</option>
            <option value="amazon">Amazon</option>
            <option value="bling">Bling</option>
          </select>
        </div>

        {/* Regime tributário */}
        <select
          value={kpis?.taxRegime ?? 'simples_nacional'}
          onChange={e => handleTaxRegimeChange(e.target.value)}
          disabled={savingTax}
          className="rounded-lg px-3 py-1.5 text-[12px] appearance-none cursor-pointer disabled:opacity-60"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: '#E8EDF5', outline: 'none' }}
          title="Regime tributário usado no cálculo de lucro"
        >
          {TAX_REGIMES.map(r => (
            <option key={r.value} value={r.value}>{r.label} ({r.rate}%)</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          {/* Sync Geral */}
          <button
            onClick={handleSyncFull}
            disabled={syncingFull || syncing}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all hover:opacity-90"
            style={{
              background: syncingFull ? 'rgba(16,212,138,0.06)' : 'rgba(16,212,138,0.1)',
              border: '1px solid rgba(16,212,138,0.3)',
              color: 'var(--emerald)',
            }}
          >
            <Database className={`h-3.5 w-3.5 ${syncingFull ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{syncingFull ? 'Sincronizando...' : 'Sync Geral'}</span>
          </button>

          {/* Sync Bling */}
          <button
            onClick={handleSync}
            disabled={syncing || syncingFull}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all hover:opacity-90"
            style={{
              background: syncing ? 'rgba(6,200,217,0.06)' : 'rgba(6,200,217,0.1)',
              border: '1px solid rgba(6,200,217,0.25)',
              color: 'var(--cyan)',
            }}
          >
            <Database className={`h-3.5 w-3.5 ${syncing ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sync Bling'}</span>
          </button>

          {/* Refresh tela */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>

        {/* Última sincronização */}
        <div className="w-full flex items-center gap-4 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
          <span>
            <span style={{ color: 'var(--sidebar-border)' }}>Bling: </span>
            <span style={{ color: data?.lastSync?.bling ? '#E8EDF5' : 'var(--sidebar-border)' }}>
              {fmtSync(data?.lastSync?.bling)}
            </span>
          </span>
          <span>
            <span style={{ color: 'var(--sidebar-border)' }}>Total Express: </span>
            <span style={{ color: data?.lastSync?.tracking ? '#E8EDF5' : 'var(--sidebar-border)' }}>
              {fmtSync(data?.lastSync?.tracking)}
            </span>
          </span>
        </div>

        {/* Sync feedback */}
        {syncMsg && (
          <div
            className="w-full rounded-lg px-3 py-2 text-[12px] font-medium"
            style={{
              background: syncMsg.startsWith('Erro') ? 'rgba(248,113,113,0.08)' : 'rgba(16,212,138,0.08)',
              border: `1px solid ${syncMsg.startsWith('Erro') ? 'rgba(248,113,113,0.2)' : 'rgba(16,212,138,0.2)'}`,
              color: syncMsg.startsWith('Erro') ? '#F87171' : 'var(--emerald)',
            }}
          >
            {syncMsg}
          </div>
        )}
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
          label="Lucro Estimado"
          value={kpis?.estimatedProfit != null ? fmt(kpis.estimatedProfit) : 'R$ —'}
          sub={kpis ? `−${fmt(kpis.totalCommission)} comissão · −${fmt(kpis.totalTax)} imposto (${kpis.taxRate}%)` : ''}
          icon={TrendingUp}
          color="var(--emerald)"
          glow="rgba(16,212,138,0.12)"
          loading={isLoading}
        />
        <KpiCard
          label="Pedidos"
          value={kpis ? String(kpis.totalOrders) : '—'}
          change={kpis?.orderChange}
          sub="vs período anterior"
          icon={ShoppingCart}
          color="#F59E0B"
          glow="rgba(245,158,11,0.12)"
          loading={isLoading}
        />
        <KpiCard
          label="Margem Média"
          value={kpis?.avgMargin != null ? `${kpis.avgMargin.toFixed(1)}%` : '—%'}
          sub={kpis ? `${kpis.productsWithCost}/${kpis.totalProducts} c/ custo` : ''}
          icon={Percent}
          color="#818CF8"
          glow="rgba(129,140,248,0.12)"
          loading={isLoading}
        />
      </div>

      {/* ── Assistência KPI ── */}
      <AssistenciaCard
        count={kpis?.assistenciaCount ?? 0}
        total={kpis?.totalOrders ?? 0}
        loading={isLoading}
      />

      {/* ── Revenue trend chart ── */}
      <Section title="Receita e Lucro Estimado">
        {!hasData && !isLoading ? (
          <EmptyChart message="Conecte seus marketplaces para ver a evolução de receita." />
        ) : isLoading ? (
          <div className="shimmer h-40 md:h-52 rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={typeof window !== 'undefined' && window.innerWidth < 768 ? 170 : 210}>
            <AreaChart data={trendData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--cyan)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10D48A" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10D48A" stopOpacity={0} />
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
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#10D48A"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                fill="url(#profitGrad)"
                dot={false}
                activeDot={{ r: 3, fill: '#10D48A', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* ── Bottom row: channel mix + orders bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">

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
                    <div key={ch.name} className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
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
                      <div className="flex items-center justify-between pl-4 text-[10px]">
                        <span style={{ color: 'var(--sidebar-border)' }}>
                          {ch.orders} pedidos · {ch.commissionRate}% comissão
                        </span>
                        <span style={{ color: '#F87171' }}>−{fmt(ch.commission)}</span>
                      </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">

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
                  const s = item.status.toLowerCase()
                  const color =
                    s.includes('entregue') || s.includes('atendido')
                      ? '#10D48A'
                    : s.includes('enviado')
                      ? '#38BDF8'
                    : s.includes('pronto para envio') || s.includes('pronto para retirada') || s.includes('entrega agendada')
                      ? '#818CF8'
                    : s.includes('assistência expedida') || s.includes('assistencia expedida')
                      ? '#7C3AED'
                    : s.includes('assistência faturada') || s.includes('assistencia faturada')
                      ? '#8B5CF6'
                    : s.includes('assist')
                      ? '#A855F7'
                    : s.includes('cancel') || s.includes('devolvido')
                      ? '#F87171'
                    : s.includes('em produção') || s.includes('em producao')
                      ? '#F97316'
                    : s.includes('em andamento')
                      ? '#06C8D9'
                    : s.includes('aguardando')
                      ? '#FBBF24'
                    : s.includes('em aberto') || s.includes('em digitação') || s.includes('pendente')
                      ? '#F59E0B'
                    : 'var(--cyan)'
                  const badge =
                    s.includes('entregue') || s.includes('atendido')   ? 'rgba(16,212,138,0.12)'
                    : s.includes('enviado')                             ? 'rgba(56,189,248,0.12)'
                    : s.includes('pronto') || s.includes('agendada')   ? 'rgba(99,102,241,0.12)'
                    : s.includes('assist')                             ? 'rgba(168,85,247,0.12)'
                    : s.includes('cancel') || s.includes('devolvido')  ? 'rgba(248,113,113,0.12)'
                    : s.includes('produção') || s.includes('producao') ? 'rgba(249,115,22,0.12)'
                    : s.includes('andamento')                          ? 'rgba(6,200,217,0.12)'
                    : s.includes('aguardando')                         ? 'rgba(251,191,36,0.12)'
                    : 'rgba(255,255,255,0.04)'
                  return (
                    <div key={item.status} className="flex items-center gap-3">
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-md capitalize shrink-0 w-44 truncate"
                        style={{ background: badge, color }}
                        title={item.status}
                      >
                        {item.status}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold w-8 text-right shrink-0" style={{ color: '#E8EDF5' }}>
                        {item.count}
                      </span>
                    </div>
                  )
                })}
            </div>
          )}
        </Section>

        {/* Products summary */}
        <Section title="Produtos e Custos">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="shimmer h-14 rounded" />)}
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
                  background: (data?.products.withCost ?? 0) > 0 ? 'rgba(16,212,138,0.06)' : 'rgba(245,158,11,0.06)',
                  border: `1px solid ${(data?.products.withCost ?? 0) > 0 ? 'rgba(16,212,138,0.2)' : 'rgba(245,158,11,0.2)'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4" style={{ color: (data?.products.withCost ?? 0) > 0 ? 'var(--emerald)' : 'var(--amber)' }} />
                  <div>
                    <span className="text-[13px] block" style={{ color: '#E8EDF5' }}>Com custo cadastrado</span>
                    {(data?.products.withCost ?? 0) === 0 && (
                      <span className="text-[10px]" style={{ color: 'var(--amber)' }}>
                        Cadastre custos para calcular lucro real
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className="font-bold text-[15px]"
                  style={{ color: (data?.products.withCost ?? 0) > 0 ? 'var(--emerald)' : 'var(--amber)', fontFamily: 'var(--font-jetbrains-mono)' }}
                >
                  {data?.products.withCost ?? '0'}/{data?.products.total ?? '—'}
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
                <span className="text-[13px] font-medium" style={{ color: 'var(--cyan)' }}>Gerenciar produtos e custos</span>
                <ArrowUpRight className="h-4 w-4" style={{ color: 'var(--cyan)' }} />
              </a>
            </div>
          )}
        </Section>
      </div>

      {/* ── Top Regiões + Pedidos Recentes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">

        {/* Top Regiões */}
        <Section
          title="Top Regiões"
          action={
            <a href="/regioes" className="flex items-center gap-1 text-[11px] transition-opacity hover:opacity-80"
              style={{ color: 'var(--cyan)' }}>
              <MapPin className="h-3 w-3" />
              Ver tudo
            </a>
          }
        >
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="shimmer h-7 rounded" />)}</div>
          ) : !data?.geoBreakdown?.length ? (
            <div className="flex h-24 items-center justify-center">
              <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>Nenhum estado mapeado ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.geoBreakdown.slice(0, 8).map((row) => {
                const maxOrd = data.geoBreakdown[0].orders
                const pct = (row.orders / maxOrd) * 100
                const revTotal = data.geoBreakdown.reduce((s, r) => s + r.revenue, 0)
                const revPct = revTotal > 0 ? ((row.revenue / revTotal) * 100).toFixed(1) : '0'
                return (
                  <div key={row.state} className="flex items-center gap-3">
                    <span className="text-[11px] font-bold w-7 text-center rounded py-0.5"
                      style={{ background: 'rgba(6,200,217,0.1)', color: 'var(--cyan)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {row.state}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--cyan), var(--emerald))' }} />
                    </div>
                    <span className="text-[11px] font-semibold w-7 text-right shrink-0" style={{ color: '#E8EDF5' }}>
                      {row.orders}
                    </span>
                    <span className="text-[11px] w-12 text-right shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                      {revPct}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        {/* Pedidos Recentes */}
        <Section
          title="Pedidos Recentes"
          action={
            <a href="/pedidos" className="flex items-center gap-1 text-[11px] transition-opacity hover:opacity-80"
              style={{ color: 'var(--cyan)' }}>
              <ExternalLink className="h-3 w-3" />
              Ver todos
            </a>
          }
        >
          {isLoading ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="shimmer h-8 rounded" />)}</div>
          ) : !(data?.recentOrders?.length) ? (
            <div className="flex h-24 items-center justify-center">
              <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>Nenhum pedido no período.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {(data?.recentOrders || []).map((order, i) => {
                const st = recentStatusStyle(order.status)
                const mpLabel = MARKETPLACE_LABELS[order.marketplace || ''] || order.marketplace || '—'
                const dateStr = order.orderDate
                  ? new Date(order.orderDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  : '—'
                return (
                  <div key={i} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <span className="text-[10px] rounded px-1.5 py-0.5 shrink-0 font-semibold"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted-foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {order.orderNumber ? `#${order.orderNumber}` : '#—'}
                    </span>
                    <span className="text-[11px] truncate flex-1 min-w-0" style={{ color: '#E8EDF5' }}>
                      {order.customerName || mpLabel}
                    </span>
                    {order.customerState && (
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                        {order.customerState}
                      </span>
                    )}
                    <span className="text-[11px] shrink-0 font-semibold"
                      style={{ color: 'var(--emerald)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {fmt(order.totalAmount)}
                    </span>
                    <span className="text-[10px] rounded px-1.5 py-0.5 shrink-0"
                      style={{ background: st.bg, color: st.color }}>
                      {order.status || '—'}
                    </span>
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--sidebar-border)' }}>{dateStr}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      </div>

      {/* ── Seção Geográfica (detalhada) ── */}
      <Section
        title="Vendas por Estado"
        action={
          data?.geoEnrichment && data.geoEnrichment.withoutState > 0 ? (
            <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--amber)' }}>
              {data.geoEnrichment.withState} de {data.geoEnrichment.withState + data.geoEnrichment.withoutState} mapeados
            </span>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="shimmer h-48 rounded-lg" />
        ) : !data?.geoBreakdown?.length ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
              Mapeando estados dos pedidos...
            </p>
            <p className="text-[11px]" style={{ color: 'var(--sidebar-border)' }}>
              O enriquecimento de endereços roda automaticamente em background.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.geoBreakdown.map((row, i) => {
              const maxOrders = data.geoBreakdown[0].orders
              const pct = (row.orders / maxOrders) * 100
              const totalRev = data.geoBreakdown.reduce((s, r) => s + r.revenue, 0)
              const revPct = totalRev > 0 ? ((row.revenue / totalRev) * 100).toFixed(1) : '0'
              return (
                <div key={row.state}>
                  <div className="flex items-center gap-3 mb-1">
                    <span
                      className="text-[12px] font-bold font-mono w-7 shrink-0 text-center rounded"
                      style={{ background: 'rgba(6,200,217,0.1)', color: 'var(--cyan)' }}
                    >
                      {row.state}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, var(--cyan), var(--emerald))` }}
                      />
                    </div>
                    <span className="text-[11px] w-8 text-right shrink-0 font-semibold" style={{ color: '#E8EDF5' }}>
                      {row.orders}
                    </span>
                    <span className="text-[11px] w-14 text-right shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                      {revPct}% fat.
                    </span>
                  </div>
                </div>
              )
            })}
            <p className="text-[11px] pt-1" style={{ color: 'var(--sidebar-border)' }}>
              💡 Estados com maior volume são bons alvos para promoções (especialmente Lucro Presumido — alíquotas menores em operações interestaduais)
            </p>
          </div>
        )}
      </Section>

    </div>
  )
}
