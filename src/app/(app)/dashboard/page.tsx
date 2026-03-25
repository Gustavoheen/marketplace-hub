import { Header } from '@/components/layout/header'
import {
  TrendingUp, TrendingDown, ShoppingCart, Package,
  Percent, Plug, ArrowUpRight, Activity, Zap,
} from 'lucide-react'

export const metadata = {
  title: 'Dashboard — Marketplace Hub',
}

const kpis = [
  {
    label: 'Receita Total',
    value: 'R$ —',
    change: null,
    sub: 'Conecte seus marketplaces',
    icon: TrendingUp,
    color: 'var(--cyan)',
    glow: 'rgba(6,200,217,0.12)',
  },
  {
    label: 'Pedidos',
    value: '—',
    change: null,
    sub: 'Últimos 30 dias',
    icon: ShoppingCart,
    color: 'var(--emerald)',
    glow: 'rgba(16,212,138,0.12)',
  },
  {
    label: 'Margem Média',
    value: '—%',
    change: null,
    sub: 'Após comissões e impostos',
    icon: Percent,
    color: 'var(--amber)',
    glow: 'rgba(245,158,11,0.12)',
  },
  {
    label: 'Canais Ativos',
    value: '0 / 9',
    change: null,
    sub: 'Conecte na aba Conexões',
    icon: Plug,
    color: '#818CF8',
    glow: 'rgba(129,140,248,0.12)',
  },
]

const steps = [
  {
    n: '01',
    title: 'Conecte seu ERP',
    desc: 'Integre o Bling para sincronizar produtos, estoque e pedidos automaticamente.',
    cta: 'Conectar Bling',
    href: '/conexoes',
    color: 'var(--cyan)',
  },
  {
    n: '02',
    title: 'Vincule seus marketplaces',
    desc: 'Conecte Mercado Livre, Shopee, Amazon e mais para ver tudo em um lugar.',
    cta: 'Ver conexões',
    href: '/conexoes',
    color: 'var(--emerald)',
  },
  {
    n: '03',
    title: 'Ative o Profit Watcher',
    desc: 'O agente de IA monitora margem em tempo real e alerta sobre problemas.',
    cta: 'Ver agentes',
    href: '/agentes',
    color: '#818CF8',
  },
]

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" description="Visão geral de todos os canais" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="card-hover rounded-xl p-5 relative overflow-hidden"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              {/* Subtle color glow behind icon */}
              <div
                className="absolute top-0 right-0 h-20 w-20 rounded-bl-full opacity-40"
                style={{ background: kpi.glow }}
              />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    {kpi.label}
                  </p>
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-md"
                    style={{ background: kpi.glow }}
                  >
                    <kpi.icon className="h-[14px] w-[14px]" style={{ color: kpi.color }} />
                  </div>
                </div>
                <p
                  className="text-2xl font-bold font-data"
                  style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}
                >
                  {kpi.value}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                  {kpi.sub}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Onboarding steps */}
        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Zap className="h-4 w-4" style={{ color: 'var(--cyan)' }} />
            <h2
              className="text-[13px] font-semibold"
              style={{ fontFamily: 'var(--font-syne)', color: '#E8EDF5' }}
            >
              Configure em 3 passos
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((step) => (
              <div
                key={step.n}
                className="rounded-lg p-4 flex flex-col gap-3"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--sidebar-border)' }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="font-bold text-[11px]"
                    style={{ fontFamily: 'var(--font-jetbrains-mono)', color: step.color }}
                  >
                    {step.n}
                  </span>
                  <p className="text-[13px] font-semibold" style={{ color: '#E8EDF5', fontFamily: 'var(--font-syne)' }}>
                    {step.title}
                  </p>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                  {step.desc}
                </p>
                <a
                  href={step.href}
                  className="flex items-center gap-1 text-[12px] font-medium mt-auto transition-opacity hover:opacity-80"
                  style={{ color: step.color }}
                >
                  {step.cta}
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Activity placeholder */}
        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
            <h2
              className="text-[13px] font-semibold"
              style={{ fontFamily: 'var(--font-syne)', color: '#E8EDF5' }}
            >
              Atividade Recente
            </h2>
          </div>
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="shimmer h-6 w-6 rounded" />
                <div className="shimmer h-3 flex-1 max-w-xs rounded" />
                <div className="shimmer h-3 w-16 rounded" />
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            Conecte seus marketplaces para ver a atividade aqui.
          </p>
        </div>

      </div>
    </div>
  )
}
