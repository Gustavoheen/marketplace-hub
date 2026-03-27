'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { RefreshCw } from 'lucide-react'
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

type TrackingRow = {
  id: string
  order_number: string | null
  nf_number: string | null
  customer_state: string | null
  tracking_code: string | null
  tracking_status: number
  tracking_desc: string | null
  tracking_date: string | null
}

type TrackingData = {
  total: number
  entregues: number
  emEntrega: number
  emTransito: number
  comProblema: number
  recent: TrackingRow[]
}

const TE_STATUS_STYLE: Record<number, { bg: string; color: string }> = {
  1:   { bg: 'rgba(16,212,138,0.12)',  color: '#10D48A' },  // entregue
  104: { bg: 'rgba(6,200,217,0.12)',   color: '#06C8D9' },  // em entrega
  91:  { bg: 'rgba(6,200,217,0.12)',   color: '#06C8D9' },
  70:  { bg: 'rgba(6,200,217,0.12)',   color: '#06C8D9' },
  101: { bg: 'rgba(129,140,248,0.12)', color: '#818CF8' },  // trânsito
  102: { bg: 'rgba(129,140,248,0.12)', color: '#818CF8' },
  103: { bg: 'rgba(129,140,248,0.12)', color: '#818CF8' },
  83:  { bg: 'rgba(129,140,248,0.12)', color: '#818CF8' },
  68:  { bg: 'rgba(129,140,248,0.12)', color: '#818CF8' },
  0:   { bg: 'rgba(245,158,11,0.10)',  color: '#F59E0B' },  // recebido
}

function teStyle(cod: number) {
  if (TE_STATUS_STYLE[cod]) return TE_STATUS_STYLE[cod]
  if (cod >= 6 && cod <= 99) return { bg: 'rgba(248,113,113,0.12)', color: '#F87171' }
  return { bg: 'rgba(255,255,255,0.04)', color: 'var(--muted-foreground)' }
}

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
  tracking,
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
  tracking?: TrackingData
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  async function handleSyncTracking() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/integracoes/totalexpress/sync-tracking', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setSyncMsg(`✓ ${data.updated} pedidos atualizados`)
      router.refresh()
    } catch (e: any) {
      setSyncMsg(`Erro: ${e.message}`)
    } finally {
      setSyncing(false)
    }
  }

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

      {/* ── Total Express Tracking ───────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-[14px] font-semibold" style={{ color: '#E8EDF5' }}>
              Tracking Total Express
            </h3>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Triangulação pelo número da NF + número do pedido via Bling
            </p>
          </div>
          <div className="flex items-center gap-3">
            {syncMsg && (
              <span className="text-[12px]" style={{ color: syncMsg.startsWith('Erro') ? '#F87171' : '#10D48A' }}>
                {syncMsg}
              </span>
            )}
            <button
              onClick={handleSyncTracking}
              disabled={syncing}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold transition-all disabled:opacity-50"
              style={{ background: 'rgba(6,200,217,0.08)', border: '1px solid rgba(6,200,217,0.25)', color: 'var(--cyan)' }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Atualizando...' : 'Atualizar Tracking'}
            </button>
          </div>
        </div>

        {/* KPIs de tracking */}
        {tracking && tracking.total > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Entregues',    value: tracking.entregues,   color: '#10D48A', bg: 'rgba(16,212,138,0.08)' },
                { label: 'Em entrega',   value: tracking.emEntrega,   color: '#06C8D9', bg: 'rgba(6,200,217,0.08)' },
                { label: 'Em trânsito',  value: tracking.emTransito,  color: '#818CF8', bg: 'rgba(129,140,248,0.08)' },
                { label: 'Com problema', value: tracking.comProblema, color: '#F87171', bg: 'rgba(248,113,113,0.08)' },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: item.bg, border: `1px solid ${item.color}25` }}>
                  <p className="text-[22px] font-bold" style={{ color: item.color, fontFamily: 'var(--font-jetbrains-mono)' }}>
                    {item.value}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{item.label}</p>
                </div>
              ))}
            </div>

            {/* Tabela pedidos recentes */}
            {tracking.recent.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Pedido', 'NF', 'Estado', 'AWB', 'Status', 'Atualizado'].map(h => (
                        <th key={h} className="text-left pb-2 pr-4 font-semibold uppercase tracking-wide text-[10px]"
                          style={{ color: 'var(--muted-foreground)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tracking.recent.map((row, i) => {
                      const st = teStyle(row.tracking_status)
                      return (
                        <tr key={row.id} style={{ borderBottom: i < tracking.recent.length - 1 ? '1px solid var(--sidebar-border)' : 'none' }}>
                          <td className="py-2 pr-4 font-mono" style={{ color: '#E8EDF5' }}>
                            {(row.order_number || row.nf_number) ? (
                              <a
                                href={`https://tracking.totalexpress.com.br/poupup_track.php?pedido=${row.order_number || ''}&nfiscal=${row.nf_number || ''}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                                style={{ color: 'var(--cyan)' }}
                              >
                                {row.order_number || '—'}
                              </a>
                            ) : '—'}
                          </td>
                          <td className="py-2 pr-4 font-mono" style={{ color: 'var(--muted-foreground)' }}>
                            {row.nf_number || '—'}
                          </td>
                          <td className="py-2 pr-4">
                            {row.customer_state ? (
                              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                                style={{ background: 'rgba(6,200,217,0.1)', color: 'var(--cyan)' }}>
                                {row.customer_state}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-2 pr-4 font-mono text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                            {row.tracking_code || '—'}
                          </td>
                          <td className="py-2 pr-4">
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ background: st.bg, color: st.color }}>
                              {row.tracking_desc || `Status ${row.tracking_status}`}
                            </span>
                          </td>
                          <td className="py-2" style={{ color: 'var(--muted-foreground)' }}>
                            {row.tracking_date
                              ? new Date(row.tracking_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
              Nenhum tracking sincronizado ainda.
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--sidebar-border)' }}>
              Clique em "Atualizar Tracking" para buscar os eventos da Total Express.
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
