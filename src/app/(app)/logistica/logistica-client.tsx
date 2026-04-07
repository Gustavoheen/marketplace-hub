'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { RefreshCw, Truck, CheckCircle, Clock, AlertCircle, Package } from 'lucide-react'

type CarrierRow = { name: string; orders: number }

type OrderRow = {
  id: string
  order_number: string | null
  nf_number: string | null
  customer_name: string | null
  customer_state: string | null
  marketplace: string | null
  status: string | null
  shipping_carrier: string | null
  tracking_code: string | null
  tracking_status: number | null
  tracking_desc: string | null
  tracking_date: string | null
  order_date: string
}

const TE_STATUS_STYLE: Record<number, { bg: string; color: string; label: string }> = {
  1:   { bg: 'rgba(16,212,138,0.12)',  color: '#10D48A', label: 'Entregue' },
  104: { bg: 'rgba(6,200,217,0.12)',   color: '#06C8D9', label: 'Em entrega' },
  91:  { bg: 'rgba(6,200,217,0.12)',   color: '#06C8D9', label: 'Em entrega' },
  70:  { bg: 'rgba(6,200,217,0.12)',   color: '#06C8D9', label: 'Em entrega' },
  101: { bg: 'rgba(129,140,248,0.12)', color: '#818CF8', label: 'Em trânsito' },
  102: { bg: 'rgba(129,140,248,0.12)', color: '#818CF8', label: 'Em trânsito' },
  103: { bg: 'rgba(129,140,248,0.12)', color: '#818CF8', label: 'Em trânsito' },
  83:  { bg: 'rgba(129,140,248,0.12)', color: '#818CF8', label: 'Em trânsito' },
  68:  { bg: 'rgba(129,140,248,0.12)', color: '#818CF8', label: 'Em trânsito' },
  0:   { bg: 'rgba(245,158,11,0.10)',  color: '#F59E0B', label: 'Recebido' },
}

function teStyle(cod: number | null) {
  if (cod === null) return { bg: 'rgba(255,255,255,0.04)', color: 'var(--muted-foreground)', label: 'Sem tracking' }
  if (TE_STATUS_STYLE[cod]) return TE_STATUS_STYLE[cod]
  if (cod >= 6 && cod <= 99) return { bg: 'rgba(248,113,113,0.12)', color: '#F87171', label: 'Problema' }
  return { bg: 'rgba(255,255,255,0.04)', color: 'var(--muted-foreground)', label: `Status ${cod}` }
}

const PERIOD_OPTIONS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: '1y', label: '1 ano' },
  { value: 'all', label: 'Tudo' },
]

export function LogisticaClient({
  totalOrders,
  semTracking,
  entregues,
  emEntrega,
  emTransito,
  comProblema,
  byCarrier,
  orderTable,
  period,
  marketplace,
  marketplaceOptions,
}: {
  totalOrders: number
  semTracking: number
  entregues: number
  emEntrega: number
  emTransito: number
  comProblema: number
  byCarrier: CarrierRow[]
  orderTable: OrderRow[]
  period: string
  marketplace?: string
  marketplaceOptions: string[]
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

  const withTracking = totalOrders - semTracking

  const kpis = [
    { label: 'Total de pedidos', value: totalOrders, icon: Package, color: '#818CF8', bg: 'rgba(129,140,248,0.08)' },
    { label: 'Entregues', value: entregues, icon: CheckCircle, color: '#10D48A', bg: 'rgba(16,212,138,0.08)' },
    { label: 'Em entrega', value: emEntrega, icon: Truck, color: '#06C8D9', bg: 'rgba(6,200,217,0.08)' },
    { label: 'Em trânsito', value: emTransito, icon: Clock, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    { label: 'Com problema', value: comProblema, icon: AlertCircle, color: '#F87171', bg: 'rgba(248,113,113,0.08)' },
    { label: 'Sem tracking', value: semTracking, icon: Package, color: 'var(--muted-foreground)', bg: 'rgba(255,255,255,0.03)' },
  ]

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--muted)' }}>
          {PERIOD_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => push('period', o.value === '30d' ? undefined : o.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {marketplaceOptions.length > 1 && (
          <select
            value={marketplace || ''}
            onChange={e => push('marketplace', e.target.value || undefined)}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <option value="">Todos os marketplaces</option>
            {marketplaceOptions.map(mp => (
              <option key={mp} value={mp}>{mp}</option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-3">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="rounded-xl p-4 text-center" style={{ background: k.bg, border: `1px solid ${k.color}25` }}>
              <Icon className="h-4 w-4 mx-auto mb-1" style={{ color: k.color }} />
              <p className="text-[22px] font-bold" style={{ color: k.color, fontFamily: 'var(--font-jetbrains-mono)' }}>
                {k.value}
              </p>
              <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--muted-foreground)' }}>{k.label}</p>
            </div>
          )
        })}
      </div>

      {/* Two columns: carriers + delivery rate */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Transportadoras */}
        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h3 className="font-semibold mb-4" style={{ color: '#E8EDF5' }}>Transportadoras</h3>
          {byCarrier.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Sem dados de transportadora</p>
          ) : (
            <div className="space-y-2">
              {byCarrier.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="text-xs w-5 text-right" style={{ color: 'var(--muted-foreground)' }}>{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <span className="text-sm ml-2" style={{ color: 'var(--muted-foreground)' }}>{c.orders} pedidos</span>
                    </div>
                    <div className="w-full rounded-full h-1.5" style={{ background: 'var(--muted)' }}>
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${byCarrier[0].orders > 0 ? (c.orders / byCarrier[0].orders) * 100 : 0}%`,
                          background: 'var(--primary)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumo de entrega */}
        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h3 className="font-semibold mb-4" style={{ color: '#E8EDF5' }}>Resumo de entrega</h3>
          <div className="space-y-3">
            {[
              { label: 'Entregues', value: entregues, color: '#10D48A' },
              { label: 'Em entrega', value: emEntrega, color: '#06C8D9' },
              { label: 'Em trânsito', value: emTransito, color: '#818CF8' },
              { label: 'Com problema', value: comProblema, color: '#F87171' },
              { label: 'Sem tracking', value: semTracking, color: 'var(--muted-foreground)' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-sm w-28" style={{ color: 'var(--muted-foreground)' }}>{item.label}</span>
                <div className="flex-1 rounded-full h-2" style={{ background: 'var(--muted)' }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${withTracking > 0 ? (item.value / totalOrders) * 100 : 0}%`,
                      background: item.color,
                    }}
                  />
                </div>
                <span className="text-sm font-semibold w-8 text-right" style={{ color: item.color }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela de pedidos */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-semibold" style={{ color: '#E8EDF5' }}>Pedidos — Status de entrega</h3>
          <span className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            {orderTable.length} exibidos
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Pedido', 'Cliente', 'UF', 'Canal', 'Transportadora', 'AWB', 'Status entrega', 'Atualizado'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--muted-foreground)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderTable.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
                    Nenhum pedido no período
                  </td>
                </tr>
              ) : orderTable.map((row, i) => {
                const st = teStyle(row.tracking_status)
                return (
                  <tr key={row.id} style={{ borderBottom: i < orderTable.length - 1 ? '1px solid var(--sidebar-border)' : 'none' }}>
                    <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--cyan)' }}>
                      {row.order_number || row.nf_number || '—'}
                    </td>
                    <td className="px-4 py-2.5 max-w-[120px] truncate" style={{ color: '#E8EDF5' }}>
                      {row.customer_name || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.customer_state ? (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                          style={{ background: 'rgba(6,200,217,0.1)', color: 'var(--cyan)' }}>
                          {row.customer_state}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 capitalize" style={{ color: 'var(--muted-foreground)' }}>
                      {row.marketplace || '—'}
                    </td>
                    <td className="px-4 py-2.5 max-w-[140px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {row.shipping_carrier || '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                      {row.tracking_code || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: st.bg, color: st.color }}>
                        {row.tracking_desc || st.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--muted-foreground)' }}>
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
      </div>

    </div>
  )
}
