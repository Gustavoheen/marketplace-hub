'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────

type Kpis = {
  totalFrete: number
  freteMedia: number
  pedidosComFrete: number
  totalOrders: number
  freightPct: number
}

type TrendPoint = { date: string; frete: number; orders: number }
type MpRow = { name: string; frete: number; orders: number; freteMedia: number; fretePct: number }
type StateRow = { state: string; orders: number; frete: number; freteMedia: number }
type CarrierRow = { name: string; orders: number; frete: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)
}

function fmtShort(v: number) {
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`
  return `R$${v.toFixed(0)}`
}

function fmtDate(d: string) {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

const PERIOD_OPTIONS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: '1y', label: '1 ano' },
  { value: 'all', label: 'Tudo' },
]

const MP_COLORS: Record<string, string> = {
  mercadolivre: '#FFE600',
  shopee: '#EE4D2D',
  amazon: '#FF9900',
  magalu: '#0086FF',
  bling: '#E8793A',
}

function getMpColor(name: string) {
  return MP_COLORS[(name || '').toLowerCase().replace(/\s/g, '')] || '#6366f1'
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function LogisticaClient({
  kpis,
  trend,
  byMarketplace,
  byState,
  byCarrier,
  semEstado,
  period,
  marketplace,
  marketplaceOptions,
}: {
  kpis: Kpis
  trend: TrendPoint[]
  byMarketplace: MpRow[]
  byState: StateRow[]
  byCarrier: CarrierRow[]
  semEstado: number
  period: string
  marketplace?: string
  marketplaceOptions: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const push = useCallback((key: string, value: string | undefined) => {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, sp])

  // top state for chart bar width scaling
  const maxStateOrders = byState[0]?.orders || 1

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Period */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {PERIOD_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => push('period', o.value === '30d' ? undefined : o.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === o.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Marketplace */}
        {marketplaceOptions.length > 1 && (
          <select
            value={marketplace || ''}
            onChange={e => push('marketplace', e.target.value || undefined)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos os marketplaces</option>
            {marketplaceOptions.map(mp => (
              <option key={mp} value={mp}>{mp}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Frete total"
          value={fmt(kpis.totalFrete)}
          sub={`${kpis.pedidosComFrete} pedidos com frete`}
        />
        <KpiCard
          label="Frete médio"
          value={fmt(kpis.freteMedia)}
          sub={`${kpis.freightPct}% dos pedidos`}
        />
        <KpiCard
          label="Total de pedidos"
          value={kpis.totalOrders.toLocaleString('pt-BR')}
          sub={`${kpis.pedidosComFrete} com frete registrado`}
        />
        <KpiCard
          label="Pedidos sem estado"
          value={semEstado.toLocaleString('pt-BR')}
          sub={semEstado > 0 ? 'Dados geográficos incompletos' : 'Todos geoloc.'}
        />
      </div>

      {/* ── Trend ───────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-4">Frete por dia</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="freightGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              interval={Math.floor(trend.length / 7)}
            />
            <YAxis
              tickFormatter={fmtShort}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              width={52}
            />
            <Tooltip
              formatter={(v: any) => [fmt(Number(v)), 'Frete']}
              labelFormatter={(d: any) => fmtDate(String(d))}
              contentStyle={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="frete"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#freightGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Two columns: by marketplace + by carrier ─────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* By marketplace */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Frete por canal</h3>
          {byMarketplace.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sem dados</p>
          ) : (
            <div className="space-y-3">
              {byMarketplace.map(mp => (
                <div key={mp.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{mp.name}</span>
                    <span className="text-sm text-muted-foreground">{fmt(mp.frete)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${byMarketplace[0].frete > 0 ? (mp.frete / byMarketplace[0].frete) * 100 : 0}%`,
                          background: getMpColor(mp.name),
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-24 text-right">
                      média {fmt(mp.freteMedia)} · {mp.fretePct}% receita
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By carrier */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-1">Transportadoras</h3>
          <p className="text-xs text-muted-foreground mb-4">Extraído dos dados brutos dos pedidos</p>
          {byCarrier.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sem dados de transportadora</p>
          ) : (
            <div className="space-y-2">
              {byCarrier.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">{c.orders} pedidos</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{
                          width: `${byCarrier[0].orders > 0 ? (c.orders / byCarrier[0].orders) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground w-20 text-right">{fmt(c.frete)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── By State ────────────────────────────────────────────────────── */}
      {byState.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Frete por estado destino</h3>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
            {byState.map(s => (
              <div key={s.state} className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-muted-foreground w-7">{s.state}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span>{s.orders} pedidos</span>
                    <span className="text-muted-foreground">{fmt(s.frete)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500"
                      style={{ width: `${(s.orders / maxStateOrders) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground w-20 text-right">
                  média {fmt(s.freteMedia)}
                </span>
              </div>
            ))}
          </div>
          {semEstado > 0 && (
            <p className="text-xs text-muted-foreground mt-4">
              {semEstado} pedidos sem estado registrado — sincronize detalhes para enriquecer os dados.
            </p>
          )}
        </div>
      )}

      {/* ── By Marketplace Bar Chart ─────────────────────────────────────── */}
      {byMarketplace.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Frete médio por canal</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byMarketplace} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              />
              <YAxis
                tickFormatter={fmtShort}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                width={52}
              />
              <Tooltip
                formatter={(v: any) => [fmt(Number(v)), 'Frete médio']}
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="freteMedia" radius={[4, 4, 0, 0]} fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  )
}
