import { Header } from '@/components/layout/header'
import { MARKETPLACE_LABELS } from '@/types'
import type { Marketplace } from '@/types'
import {
  Plug, CheckCircle2, Clock, AlertTriangle,
  ArrowRight, Zap, ExternalLink,
} from 'lucide-react'

export const metadata = {
  title: 'Conexões — Marketplace Hub',
}

type MarketplaceConfig = {
  mp: Marketplace
  color: string
  glow: string
  category: 'erp' | 'marketplace'
  priority?: boolean
}

const configs: MarketplaceConfig[] = [
  { mp: 'bling', color: '#06C8D9', glow: 'rgba(6,200,217,0.12)', category: 'erp', priority: true },
  { mp: 'mercadolivre', color: '#F59E0B', glow: 'rgba(245,158,11,0.12)', category: 'marketplace', priority: true },
  { mp: 'shopee', color: '#F97316', glow: 'rgba(249,115,22,0.12)', category: 'marketplace' },
  { mp: 'amazon', color: '#F59E0B', glow: 'rgba(245,158,11,0.12)', category: 'marketplace' },
  { mp: 'magalu', color: '#3B82F6', glow: 'rgba(59,130,246,0.12)', category: 'marketplace' },
  { mp: 'shein', color: '#EC4899', glow: 'rgba(236,72,153,0.12)', category: 'marketplace' },
  { mp: 'casas_bahia', color: '#10D48A', glow: 'rgba(16,212,138,0.12)', category: 'marketplace' },
  { mp: 'webcontinental', color: '#818CF8', glow: 'rgba(129,140,248,0.12)', category: 'marketplace' },
  { mp: 'madeiramadeira', color: '#A78BFA', glow: 'rgba(167,139,250,0.12)', category: 'marketplace' },
]

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function ConexoesPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Conexões" description="ERPs e marketplaces" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Stats bar */}
        <div
          className="flex items-center gap-6 rounded-xl px-5 py-4"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--muted-foreground)' }} />
            <span className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
              <span className="font-bold font-data" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>0</span>
              {' '}conectados
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--emerald)' }} />
            <span className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
              <span className="font-bold font-data" style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>9</span>
              {' '}disponíveis
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            <Zap className="h-3.5 w-3.5" style={{ color: 'var(--cyan)' }} />
            Comece pelo Bling para sincronizar produtos
          </div>
        </div>

        {/* ERP Section */}
        <div className="space-y-3">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest px-1"
            style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-syne)' }}
          >
            ERP
          </p>
          <div className="grid grid-cols-1 gap-3">
            {configs.filter((c) => c.category === 'erp').map(({ mp, color, glow }) => (
              <MarketplaceCard key={mp} mp={mp} color={color} glow={glow} priority />
            ))}
          </div>
        </div>

        {/* Marketplaces Section */}
        <div className="space-y-3">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest px-1"
            style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-syne)' }}
          >
            Marketplaces
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {configs.filter((c) => c.category === 'marketplace').map(({ mp, color, glow, priority }) => (
              <MarketplaceCard key={mp} mp={mp} color={color} glow={glow} priority={priority} />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function MarketplaceCard({
  mp,
  color,
  glow,
  priority,
}: {
  mp: Marketplace
  color: string
  glow: string
  priority?: boolean
}) {
  const name = MARKETPLACE_LABELS[mp]
  const initials = getInitials(name)

  return (
    <div
      className="card-hover flex items-center gap-4 rounded-xl p-4"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      {/* Avatar */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold"
        style={{
          background: glow,
          border: `1px solid ${color}26`,
          color,
          fontFamily: 'var(--font-syne)',
        }}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold truncate" style={{ color: '#E8EDF5' }}>
            {name}
          </p>
          {priority && (
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide shrink-0"
              style={{ background: 'rgba(6,200,217,0.12)', color: 'var(--cyan)' }}
            >
              PRIORIDADE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="h-3 w-3 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            Não conectado
          </p>
        </div>
      </div>

      {/* CTA */}
      <button
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all shrink-0"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--sidebar-border)',
          color: 'var(--muted-foreground)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = glow
          ;(e.currentTarget as HTMLElement).style.borderColor = `${color}40`
          ;(e.currentTarget as HTMLElement).style.color = color
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-border)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
        }}
      >
        Conectar
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  )
}
