'use client'

import { useEffect, useState } from 'react'
import { MARKETPLACE_LABELS } from '@/types'
import type { Marketplace, ConnectionStatus } from '@/types'
import type { MARKETPLACE_CONFIGS } from './page'
import {
  CheckCircle2, Clock, ArrowRight, Zap, XCircle,
  RefreshCw, AlertTriangle, Unplug,
} from 'lucide-react'

type Config = (typeof MARKETPLACE_CONFIGS)[number]

type ConnectionInfo = {
  marketplace: Marketplace
  status: ConnectionStatus
  expiresAt: Date | null
  metadata: Record<string, unknown> | null
  updatedAt: Date
}

const OAUTH_MARKETPLACES: Marketplace[] = ['bling', 'mercadolivre']

function getAuthUrl(mp: Marketplace): string {
  return `/api/integracoes/${mp === 'mercadolivre' ? 'ml' : mp}/auth`
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === 'active') {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--emerald)' }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--emerald)' }}>Conectado</span>
      </div>
    )
  }
  if (status === 'expired') {
    return (
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--amber)' }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--amber)' }}>Token expirado</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <Clock className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
      <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Não conectado</span>
    </div>
  )
}

function MarketplaceCard({
  config,
  connection,
  isSyncing,
  onSync,
}: {
  config: Config
  connection?: ConnectionInfo
  isSyncing?: boolean
  onSync?: () => void
}) {
  const { mp, color, glow, priority } = config
  const name = MARKETPLACE_LABELS[mp]
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const connected = connection?.status === 'active'
  const hasOAuth = OAUTH_MARKETPLACES.includes(mp)

  return (
    <div
      className="card-hover rounded-xl p-4 flex items-center gap-4"
      style={{
        background: 'var(--card)',
        border: connected ? `1px solid ${color}30` : '1px solid var(--border)',
        boxShadow: connected ? `0 0 12px ${glow}` : 'none',
      }}
    >
      {/* Avatar */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold"
        style={{
          background: connected ? glow : 'rgba(255,255,255,0.03)',
          border: `1px solid ${connected ? color + '30' : 'var(--sidebar-border)'}`,
          color: connected ? color : 'var(--muted-foreground)',
          fontFamily: 'var(--font-syne)',
        }}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[13px] font-semibold truncate" style={{ color: '#E8EDF5' }}>
            {name}
          </p>
          {priority && !connected && (
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide shrink-0"
              style={{ background: 'rgba(6,200,217,0.12)', color: 'var(--cyan)' }}
            >
              PRIORIDADE
            </span>
          )}
        </div>
        <StatusBadge status={connection?.status ?? 'disconnected'} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {connected && mp === 'bling' && (
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all disabled:opacity-60"
            style={{
              background: 'rgba(16,212,138,0.08)',
              border: '1px solid rgba(16,212,138,0.2)',
              color: 'var(--emerald)',
            }}
            title="Sincronizar produtos"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sync'}
          </button>
        )}

        {hasOAuth ? (
          <a
            href={connected ? '#' : getAuthUrl(mp)}
            onClick={connected ? (e) => e.preventDefault() : undefined}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all"
            style={{
              background: connected ? 'rgba(244,63,94,0.06)' : 'rgba(255,255,255,0.04)',
              border: connected ? '1px solid rgba(244,63,94,0.15)' : '1px solid var(--sidebar-border)',
              color: connected ? 'var(--rose)' : 'var(--muted-foreground)',
              cursor: connected ? 'default' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!connected) {
                (e.currentTarget as HTMLElement).style.background = glow
                ;(e.currentTarget as HTMLElement).style.borderColor = `${color}40`
                ;(e.currentTarget as HTMLElement).style.color = color
              }
            }}
            onMouseLeave={(e) => {
              if (!connected) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-border)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
              }
            }}
          >
            {connected ? (
              <>
                <Unplug className="h-3 w-3" />
                Conectado
              </>
            ) : (
              <>
                Conectar
                <ArrowRight className="h-3 w-3" />
              </>
            )}
          </a>
        ) : (
          <span
            className="rounded-lg px-3 py-1.5 text-[11px] font-medium"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--sidebar-border)',
              color: 'var(--muted-foreground)',
            }}
          >
            Em breve
          </span>
        )}
      </div>
    </div>
  )
}

export function ConexoesClient({
  configs,
  connectionMap,
  activeCount,
  successParam,
  errorParam,
}: {
  configs: Config[]
  connectionMap: Record<Marketplace, ConnectionInfo | undefined>
  activeCount: number
  successParam?: string
  errorParam?: string
}) {
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [syncingMp, setSyncingMp] = useState<Marketplace | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  useEffect(() => {
    if (successParam === 'bling') setToast({ type: 'success', msg: 'Bling conectado com sucesso!' })
    else if (successParam === 'ml') setToast({ type: 'success', msg: 'Mercado Livre conectado!' })
    else if (errorParam) setToast({ type: 'error', msg: decodeURIComponent(errorParam) })

    if (successParam || errorParam) {
      const t = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(t)
    }
  }, [successParam, errorParam])

  async function handleSync(mp: Marketplace) {
    setSyncingMp(mp)
    setSyncResult(null)
    try {
      const res = await fetch(`/api/integracoes/${mp}/sync`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSyncResult(`${data.synced} produtos sincronizados`)
        setToast({ type: 'success', msg: `${data.synced} produtos sincronizados do Bling!` })
      } else {
        setToast({ type: 'error', msg: data.error || 'Erro no sync' })
      }
    } catch {
      setToast({ type: 'error', msg: 'Erro de conexão' })
    } finally {
      setSyncingMp(null)
      setTimeout(() => setToast(null), 5000)
    }
  }

  const erp = configs.filter((c) => c.category === 'erp')
  const markets = configs.filter((c) => c.category === 'marketplace')
  const totalMps = configs.length

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium shadow-xl"
          style={{
            background: toast.type === 'success' ? 'rgba(16,212,138,0.12)' : 'rgba(244,63,94,0.12)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(16,212,138,0.3)' : 'rgba(244,63,94,0.3)'}`,
            color: toast.type === 'success' ? 'var(--emerald)' : 'var(--rose)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <div
        className="flex items-center gap-6 rounded-xl px-5 py-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: activeCount > 0 ? 'var(--emerald)' : 'var(--muted-foreground)' }} />
          <span className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            <span className="font-bold font-data" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>
              {activeCount}
            </span>
            {' '}conectados
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <span className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            <span className="font-bold font-data" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>
              {totalMps}
            </span>
            {' '}disponíveis
          </span>
        </div>
        {activeCount === 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            <Zap className="h-3.5 w-3.5" style={{ color: 'var(--cyan)' }} />
            Comece pelo Bling ERP
          </div>
        )}
        {syncResult && (
          <div className="ml-auto text-[12px]" style={{ color: 'var(--emerald)' }}>
            {syncResult}
          </div>
        )}
      </div>

      {/* ERP */}
      <div className="space-y-3">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest px-1"
          style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-syne)' }}
        >
          ERP
        </p>
        <div className="space-y-3">
          {erp.map((config) => (
            <MarketplaceCard
              key={config.mp}
              config={config}
              connection={connectionMap[config.mp]}
              isSyncing={syncingMp === config.mp}
              onSync={() => handleSync(config.mp)}
            />
          ))}
        </div>
      </div>

      {/* Marketplaces */}
      <div className="space-y-3">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest px-1"
          style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-syne)' }}
        >
          Marketplaces
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {markets.map((config) => (
            <MarketplaceCard
              key={config.mp}
              config={config}
              connection={connectionMap[config.mp]}
              isSyncing={syncingMp === config.mp}
              onSync={() => handleSync(config.mp)}
            />
          ))}
        </div>
      </div>

    </div>
  )
}
