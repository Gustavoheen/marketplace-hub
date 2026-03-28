'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { MapPin } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface RegiaoData {
  name: string
  orders: number
  revenue: number
  states: number
}

interface StateData {
  uf: string
  name: string
  region: string
  orders: number
  revenue: number
  pct: number
  avgDeliveryDays: number | null
  topProduct: string | null
}

interface TopState {
  uf: string
  orders: number
  revenue: number
}

interface RegioesStats {
  summary: { totalOrders: number; totalRevenue: number }
  regions: RegiaoData[]
  states: StateData[]
  topStates: TopState[]
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

const REGION_COLORS: Record<string, string> = {
  'Sudeste':     'var(--cyan)',
  'Sul':         'var(--emerald)',
  'Nordeste':    '#F59E0B',
  'Centro-Oeste':'#818CF8',
  'Norte':       '#F97316',
}

const REGION_GLOW: Record<string, string> = {
  'Sudeste':     'rgba(6,200,217,0.12)',
  'Sul':         'rgba(16,212,138,0.12)',
  'Nordeste':    'rgba(245,158,11,0.12)',
  'Centro-Oeste':'rgba(129,140,248,0.12)',
  'Norte':       'rgba(249,115,22,0.12)',
}

// Brazil tile-map grid layout: [row, col] for each UF
const TILE_GRID: Record<string, [number, number]> = {
  RR: [0, 2], AP: [0, 5],
  AM: [1, 2], PA: [1, 4], MA: [1, 6], CE: [1, 8], RN: [1, 9],
  AC: [2, 0], RO: [2, 2], TO: [2, 5], PI: [2, 7], PB: [2, 9],
  MT: [3, 3], GO: [3, 5], BA: [3, 7], PE: [3, 9], AL: [3, 10], SE: [4, 9],
  DF: [4, 5], MG: [4, 6], ES: [4, 8],
  MS: [5, 4], RJ: [5, 7],
  SP: [6, 5],
  PR: [7, 5], SC: [7, 6],
  RS: [8, 5],
}

const UF_TO_REGION: Record<string, string> = {
  AC: 'Norte', AM: 'Norte', AP: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte',
  AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste',
  PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste',
  DF: 'Centro-Oeste', GO: 'Centro-Oeste', MS: 'Centro-Oeste', MT: 'Centro-Oeste',
  ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste',
  PR: 'Sul', RS: 'Sul', SC: 'Sul',
}

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

// ── Bar Tooltip ────────────────────────────────────────────────────────────

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-[12px]"
      style={{ background: '#0F1623', border: '1px solid var(--border)', color: '#E8EDF5' }}>
      <p className="font-semibold mb-1" style={{ color: '#E8EDF5' }}>{label}</p>
      <p style={{ color: 'var(--cyan)' }}>Pedidos: <span className="font-bold">{payload[0]?.value}</span></p>
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

// ── Brazil Tile Map ────────────────────────────────────────────────────────

function BrazilTileMap({ states, maxOrders }: { states: StateData[]; maxOrders: number }) {
  const ordersByUf = Object.fromEntries(states.map(s => [s.uf, s.orders]))
  const [hovered, setHovered] = useState<string | null>(null)

  const ROWS = 9
  const COLS = 11
  const TILE = 36
  const GAP = 3

  return (
    <div className="relative" style={{ height: ROWS * (TILE + GAP) + 8 }}>
      <svg
        width="100%"
        viewBox={`0 0 ${COLS * (TILE + GAP)} ${ROWS * (TILE + GAP)}`}
        style={{ overflow: 'visible' }}
      >
        {Object.entries(TILE_GRID).map(([uf, [row, col]]) => {
          const orders = ordersByUf[uf] || 0
          const region = UF_TO_REGION[uf] || 'Outros'
          const baseColor = REGION_COLORS[region] || '#334155'
          const intensity = maxOrders > 0 ? orders / maxOrders : 0
          const x = col * (TILE + GAP)
          const y = row * (TILE + GAP)
          const isHovered = hovered === uf

          return (
            <g
              key={uf}
              onMouseEnter={() => setHovered(uf)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x} y={y}
                width={TILE} height={TILE}
                rx={4}
                fill={orders > 0 ? baseColor : 'rgba(255,255,255,0.04)'}
                fillOpacity={orders > 0 ? 0.15 + intensity * 0.7 : 1}
                stroke={isHovered ? baseColor : orders > 0 ? baseColor : 'rgba(255,255,255,0.08)'}
                strokeWidth={isHovered ? 2 : 0.5}
                strokeOpacity={isHovered ? 1 : 0.3}
              />
              <text
                x={x + TILE / 2} y={y + TILE / 2 - 4}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fontWeight={600}
                fill={orders > 0 ? '#E8EDF5' : '#475569'}
                fontFamily="var(--font-jetbrains-mono)"
              >
                {uf}
              </text>
              <text
                x={x + TILE / 2} y={y + TILE / 2 + 8}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={9}
                fill={orders > 0 ? baseColor : '#334155'}
              >
                {orders > 0 ? orders : ''}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(REGION_COLORS).map(([region, color]) => (
          <div key={region} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ background: color, opacity: 0.7 }} />
            <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{region}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function RegioesClient() {
  const [period, setPeriod] = useState('30d')

  const { data, isLoading } = useQuery<RegioesStats>({
    queryKey: ['regioes-stats', period],
    queryFn: async () => {
      const res = await fetch(`/api/regioes/stats?period=${period}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: true,
  })

  const hasData = (data?.states || []).length > 0
  const maxOrders = Math.max(...(data?.states || []).map(s => s.orders), 1)

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
        {data?.summary && (
          <div className="ml-auto flex items-center gap-3 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            <span><span style={{ color: '#E8EDF5', fontWeight: 600 }}>{data.summary.totalOrders}</span> pedidos</span>
            <span><span style={{ color: '#E8EDF5', fontWeight: 600 }}>{fmt(data.summary.totalRevenue)}</span> faturados</span>
          </div>
        )}
      </div>

      {/* ── Region KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => <div key={i} className="shimmer h-24 rounded-xl" />)
        ) : (
          (data?.regions || []).map(region => {
            const color = REGION_COLORS[region.name] || 'var(--cyan)'
            const glow = REGION_GLOW[region.name] || 'rgba(6,200,217,0.12)'
            return (
              <div key={region.name} className="rounded-xl p-4 relative overflow-hidden"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="absolute top-0 right-0 h-16 w-16 rounded-bl-full opacity-30" style={{ background: glow }} />
                <p className="text-[11px] font-semibold mb-2" style={{ color, fontFamily: 'var(--font-syne)' }}>
                  {region.name}
                </p>
                <p className="text-xl font-bold" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>
                  {region.orders}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color }}>
                  {fmt(region.revenue)}
                </p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {region.states} {region.states === 1 ? 'estado' : 'estados'}
                </p>
              </div>
            )
          })
        )}
      </div>

      {/* ── Map + Bar chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">

        {/* Tile Map */}
        <Section title="Concentração de Pedidos por Estado">
          {!hasData && !isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
                Nenhum pedido com estado registrado.
              </p>
            </div>
          ) : isLoading ? (
            <div className="shimmer h-64 rounded-lg" />
          ) : (
            <BrazilTileMap states={data?.states || []} maxOrders={maxOrders} />
          )}
        </Section>

        {/* Bar chart: top states */}
        <Section title="Pedidos por Estado (Top 15)">
          {!hasData && !isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>Nenhum dado disponível.</p>
            </div>
          ) : isLoading ? (
            <div className="shimmer h-64 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data?.topStates || []}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number"
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="uf"
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="orders" radius={[0, 4, 4, 0]} maxBarSize={14} fillOpacity={0.85}>
                  {(data?.topStates || []).map((entry, i) => {
                    const region = UF_TO_REGION[entry.uf] || 'Outros'
                    const color = REGION_COLORS[region] || 'var(--cyan)'
                    return <Cell key={i} fill={color} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* ── Detailed state table ── */}
      <Section title={`Detalhamento por Estado (${(data?.states || []).length} com pedidos)`}>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="shimmer h-10 rounded" />)}
          </div>
        ) : !hasData ? (
          <div className="flex h-24 items-center justify-center">
            <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
              Nenhum dado de estado disponível. Sincronize pedidos com o Bling.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Estado', 'UF', 'Região', 'Pedidos', 'Faturamento', '% Total', 'Prazo Médio', 'Top Produto'].map(h => (
                    <th key={h} className="py-2 px-3 text-left font-semibold"
                      style={{ color: 'var(--muted-foreground)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.states || []).map((state, i) => {
                  const color = REGION_COLORS[state.region] || 'var(--cyan)'
                  return (
                    <tr key={state.uf}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <td className="py-2 px-3" style={{ color: '#E8EDF5' }}>{state.name}</td>
                      <td className="py-2 px-3">
                        <span className="font-bold" style={{ color, fontFamily: 'var(--font-jetbrains-mono)' }}>
                          {state.uf}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="rounded px-1.5 py-0.5 text-[10px]"
                          style={{ background: color + '20', color }}>
                          {state.region}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>
                        {state.orders}
                      </td>
                      <td className="py-2 px-3" style={{ color: 'var(--emerald)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                        {fmt(state.revenue)}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-12 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(state.pct * 5, 100)}%`, background: color }} />
                          </div>
                          <span style={{ color: 'var(--muted-foreground)' }}>{state.pct}%</span>
                        </div>
                      </td>
                      <td className="py-2 px-3" style={{ color: state.avgDeliveryDays ? '#E8EDF5' : 'var(--sidebar-border)' }}>
                        {state.avgDeliveryDays ? `${state.avgDeliveryDays} dias` : '—'}
                      </td>
                      <td className="py-2 px-3 max-w-[160px] truncate" style={{ color: 'var(--muted-foreground)' }}
                        title={state.topProduct || undefined}>
                        {state.topProduct || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
