'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Percent, CreditCard, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface FinanceiroStats {
  kpis: {
    totalRevenue: number
    lucroLiquido: number
    custoOperacional: number
    ticketMedio: number
    margemLiquida: number
    totalCommission: number
    totalShipping: number
    totalTax: number
    taxRate: number
    totalOrders: number
  }
  trend: Array<{ date: string; revenue: number; cost: number; profit: number }>
  costComposition: Array<{ name: string; value: number }>
  paymentMethods: Array<{ name: string; count: number; total: number }>
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

const COST_COLORS = ['#F87171', '#F59E0B', '#818CF8']
const PAYMENT_COLOR = 'var(--cyan)'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}K`
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
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

// ── Custom Tooltips ────────────────────────────────────────────────────────

function TrendTooltip({ active, payload, label, period }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-[12px]"
      style={{ background: '#0F1623', border: '1px solid var(--border)', color: '#E8EDF5' }}>
      <p className="mb-1 font-semibold" style={{ color: 'var(--muted-foreground)' }}>
        {fmtDate(label, period)}
      </p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey === 'revenue' ? 'Receita' : p.dataKey === 'cost' ? 'Custo' : 'Lucro'}:{' '}
          <span className="font-bold">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const total = d.payload.total
  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0'
  return (
    <div className="rounded-lg px-3 py-2 text-[12px]"
      style={{ background: '#0F1623', border: '1px solid var(--border)', color: '#E8EDF5' }}>
      <p style={{ color: d.payload.fill }}>{d.name}</p>
      <p className="font-bold">{fmt(d.value)}</p>
      <p style={{ color: 'var(--muted-foreground)' }}>{pct}% do custo total</p>
    </div>
  )
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-[12px]"
      style={{ background: '#0F1623', border: '1px solid var(--border)', color: '#E8EDF5' }}>
      <p className="mb-1 font-semibold" style={{ color: '#E8EDF5' }}>{label}</p>
      <p style={{ color: 'var(--cyan)' }}>Total: <span className="font-bold">{fmt(payload[0]?.value)}</span></p>
      <p style={{ color: 'var(--muted-foreground)' }}>{payload[1]?.value} pedidos</p>
    </div>
  )
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color, glow, loading, highlight,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string; glow: string
  loading?: boolean; highlight?: boolean
}) {
  return (
    <div className="rounded-xl p-4 md:p-5 relative overflow-hidden"
      style={{
        background: 'var(--card)',
        border: `1px solid ${highlight ? color + '44' : 'var(--border)'}`,
      }}>
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
        {sub && (
          <p className="mt-1 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{sub}</p>
        )}
      </div>
    </div>
  )
}

// ── Section ────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <h2 className="text-[13px] font-semibold mb-4" style={{ fontFamily: 'var(--font-syne)', color: '#E8EDF5' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center">
      <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>{message}</p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function FinanceiroClient() {
  const [period, setPeriod] = useState('30d')

  const { data, isLoading } = useQuery<FinanceiroStats>({
    queryKey: ['financeiro-stats', period],
    queryFn: async () => {
      const res = await fetch(`/api/financeiro/stats?period=${period}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: true,
  })

  const kpis = data?.kpis
  const hasData = (data?.trend || []).some(t => t.revenue > 0)
  const hasCosts = (data?.costComposition || []).length > 0
  const hasPayments = (data?.paymentMethods || []).some(p => p.name !== 'Outros' || p.count > 0)

  const trendData = period === '1y'
    ? (data?.trend || []).filter((_, i) => i % 7 === 0)
    : (data?.trend || [])

  // Enrich pie data with total for tooltip
  const totalCost = (data?.costComposition || []).reduce((s, c) => s + c.value, 0)
  const pieData = (data?.costComposition || []).map(c => ({ ...c, total: totalCost }))

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-5 pb-2">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg p-1"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className="rounded-md px-3 py-1.5 text-[12px] font-medium transition-all"
              style={{
                background: period === p.value ? 'rgba(6,200,217,0.12)' : 'transparent',
                color: period === p.value ? 'var(--cyan)' : 'var(--muted-foreground)',
                border: period === p.value ? '1px solid rgba(6,200,217,0.25)' : '1px solid transparent',
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <KpiCard
          label="Faturamento Bruto"
          value={kpis ? fmt(kpis.totalRevenue) : 'R$ —'}
          sub={`${kpis?.totalOrders ?? 0} pedidos no período`}
          icon={TrendingUp}
          color="var(--cyan)"
          glow="rgba(6,200,217,0.12)"
          loading={isLoading}
        />
        <KpiCard
          label="Lucro Líquido"
          value={kpis ? fmt(kpis.lucroLiquido) : 'R$ —'}
          sub={kpis ? `Margem ${kpis.margemLiquida.toFixed(1)}%` : ''}
          icon={TrendingUp}
          color="var(--emerald)"
          glow="rgba(16,212,138,0.12)"
          loading={isLoading}
          highlight
        />
        <KpiCard
          label="Custo Operacional"
          value={kpis ? fmt(kpis.custoOperacional) : 'R$ —'}
          sub={kpis ? `Comissão + Frete + Imposto (${kpis.taxRate}%)` : ''}
          icon={TrendingDown}
          color="#F87171"
          glow="rgba(248,113,113,0.12)"
          loading={isLoading}
        />
        <KpiCard
          label="Ticket Médio"
          value={kpis ? fmt(kpis.ticketMedio) : 'R$ —'}
          sub="por pedido"
          icon={ShoppingCart}
          color="#F59E0B"
          glow="rgba(245,158,11,0.12)"
          loading={isLoading}
        />
        <KpiCard
          label="Margem Líquida"
          value={kpis ? `${kpis.margemLiquida.toFixed(1)}%` : '—%'}
          sub="sobre faturamento bruto"
          icon={Percent}
          color="#818CF8"
          glow="rgba(129,140,248,0.12)"
          loading={isLoading}
        />
        <KpiCard
          label="Total Comissões"
          value={kpis ? fmt(kpis.totalCommission) : 'R$ —'}
          sub={kpis ? `Frete: ${fmt(kpis.totalShipping)}` : ''}
          icon={CreditCard}
          color="#F97316"
          glow="rgba(249,115,22,0.12)"
          loading={isLoading}
        />
      </div>

      {/* ── Trend chart: Receita × Custo × Lucro ── */}
      <Section title="Faturamento × Custo × Lucro">
        {!hasData && !isLoading ? (
          <EmptyChart message="Conecte seus marketplaces para ver a evolução financeira." />
        ) : isLoading ? (
          <div className="shimmer h-52 rounded-lg" />
        ) : (
          <>
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              {[
                { key: 'revenue', label: 'Faturamento', color: 'var(--cyan)' },
                { key: 'cost', label: 'Custo', color: '#F87171' },
                { key: 'profit', label: 'Lucro', color: 'var(--emerald)' },
              ].map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="h-2 w-4 rounded-full" style={{ background: color }} />
                  <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={d => fmtDate(d, period)}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={fmtShort}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  axisLine={false} tickLine={false} width={48}
                />
                <Tooltip content={<TrendTooltip period={period} />} />
                <Line type="monotone" dataKey="revenue" stroke="var(--cyan)" strokeWidth={2}
                  dot={false} activeDot={{ r: 4, fill: 'var(--cyan)', strokeWidth: 0 }} />
                <Line type="monotone" dataKey="cost" stroke="#F87171" strokeWidth={1.5}
                  strokeDasharray="4 2" dot={false} activeDot={{ r: 3, fill: '#F87171', strokeWidth: 0 }} />
                <Line type="monotone" dataKey="profit" stroke="#10D48A" strokeWidth={2}
                  dot={false} activeDot={{ r: 4, fill: '#10D48A', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </Section>

      {/* ── Bottom row: cost pie + payment bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">

        {/* Cost Composition Pie */}
        <Section title="Composição de Custos">
          {!hasCosts && !isLoading ? (
            <EmptyChart message="Nenhum dado de custo disponível." />
          ) : isLoading ? (
            <div className="shimmer h-48 rounded-lg" />
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={48} outerRadius={72}
                    paddingAngle={3} dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {pieData.map((item, i) => {
                  const pct = totalCost > 0 ? ((item.value / totalCost) * 100).toFixed(1) : '0'
                  const color = COST_COLORS[i % COST_COLORS.length]
                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>{item.name}</span>
                        </div>
                        <span className="text-[12px] font-semibold" style={{ color: '#E8EDF5' }}>{pct}%</span>
                      </div>
                      <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <p className="text-[11px] pl-4" style={{ color: 'var(--sidebar-border)' }}>{fmt(item.value)}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Section>

        {/* Payment Methods Bar */}
        <Section title="Métodos de Pagamento">
          {!hasPayments && !isLoading ? (
            <EmptyChart message="Dados de pagamento não disponíveis no ERP." />
          ) : isLoading ? (
            <div className="shimmer h-48 rounded-lg" />
          ) : (data?.paymentMethods || []).every(p => p.name === 'Outros') ? (
            <div className="space-y-2">
              {(data?.paymentMethods || []).map(pm => (
                <div key={pm.name} className="flex items-center justify-between rounded-lg p-3"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <span className="text-[13px]" style={{ color: '#E8EDF5' }}>{pm.name}</span>
                  <div className="text-right">
                    <p className="text-[13px] font-semibold" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {fmt(pm.total)}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{pm.count} pedidos</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data?.paymentMethods} layout="vertical"
                margin={{ top: 5, right: 60, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tickFormatter={fmtShort}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name"
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="total" fill="var(--cyan)" radius={[0, 4, 4, 0]} maxBarSize={18} fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* ── Cost breakdown detail ── */}
      {kpis && (kpis.totalCommission > 0 || kpis.totalShipping > 0 || kpis.totalTax > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'Comissões', value: kpis.totalCommission, sub: `Média por pedido: ${fmt(kpis.totalCommission / Math.max(kpis.totalOrders, 1))}`, color: '#F87171', glow: 'rgba(248,113,113,0.08)' },
            { label: 'Frete Pago', value: kpis.totalShipping, sub: `Média por pedido: ${fmt(kpis.totalShipping / Math.max(kpis.totalOrders, 1))}`, color: '#F59E0B', glow: 'rgba(245,158,11,0.08)' },
            { label: 'Impostos', value: kpis.totalTax, sub: `Alíquota: ${kpis.taxRate}% sobre faturamento`, color: '#818CF8', glow: 'rgba(129,140,248,0.08)' },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-4" style={{ background: item.glow, border: `1px solid ${item.color}33` }}>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{item.label}</p>
              <p className="text-xl font-bold" style={{ color: item.color, fontFamily: 'var(--font-jetbrains-mono)' }}>
                {fmt(item.value)}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--sidebar-border)' }}>{item.sub}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
