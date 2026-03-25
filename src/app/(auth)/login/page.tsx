import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { LayoutDashboard, TrendingUp, Bot, Link2 } from 'lucide-react'

export const metadata = {
  title: 'Entrar — Marketplace Hub',
}

const features = [
  { icon: LayoutDashboard, label: 'BI unificado', desc: '9 marketplaces em um painel' },
  { icon: TrendingUp, label: 'Motor de preços', desc: 'Precificação inteligente com IA' },
  { icon: Bot, label: 'Agentes autônomos', desc: 'Profit Watcher 24/7' },
  { icon: Link2, label: 'Multi-tenant', desc: 'Gerencie vários clientes' },
]

export default function LoginPage() {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>

      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-[480px] xl:w-[520px] shrink-0 flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: '#0A0E18', borderRight: '1px solid var(--sidebar-border)' }}
      >
        {/* Dot grid bg */}
        <div className="bg-grid absolute inset-0 opacity-60" />

        {/* Cyan glow blob */}
        <div
          className="absolute -top-20 -left-20 h-80 w-80 rounded-full opacity-10 blur-3xl"
          style={{ background: 'var(--cyan)' }}
        />
        <div
          className="absolute bottom-0 right-0 h-60 w-60 rounded-full opacity-8 blur-3xl"
          style={{ background: '#818CF8' }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[13px] font-bold shrink-0"
            style={{
              background: 'linear-gradient(135deg, #06C8D9 0%, #0891B2 100%)',
              color: '#07090F',
              fontFamily: 'var(--font-syne)',
              boxShadow: '0 0 16px rgba(6,200,217,0.4)',
            }}
          >
            MH
          </div>
          <div>
            <p className="text-[14px] font-bold" style={{ fontFamily: 'var(--font-syne)', color: '#E8EDF5' }}>
              Marketplace Hub
            </p>
            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
              Command Center
            </p>
          </div>
        </div>

        {/* Center copy */}
        <div className="relative space-y-8">
          <div className="space-y-3">
            <h1
              className="text-4xl font-bold leading-tight"
              style={{ fontFamily: 'var(--font-syne)', color: '#E8EDF5', letterSpacing: '-0.03em' }}
            >
              Gestão total de
              <br />
              <span style={{ color: 'var(--cyan)' }}>marketplaces</span>
            </h1>
            <p className="text-[14px] leading-relaxed max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
              Da auditoria à expansão — tudo que um analista de e-commerce precisa em um único hub.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                  style={{ background: 'rgba(6,200,217,0.08)', border: '1px solid rgba(6,200,217,0.15)' }}
                >
                  <Icon className="h-[15px] w-[15px]" style={{ color: 'var(--cyan)' }} />
                </div>
                <div>
                  <p className="text-[12px] font-semibold" style={{ color: '#E8EDF5' }}>{label}</p>
                  <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative flex items-center gap-2">
          <span className="live-dot h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--emerald)' }} />
          <span className="text-[11px]" style={{ color: 'var(--emerald)' }}>Sistema operacional</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[360px] space-y-8">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
              style={{
                background: 'linear-gradient(135deg, #06C8D9 0%, #0891B2 100%)',
                color: '#07090F',
                fontFamily: 'var(--font-syne)',
              }}
            >
              MH
            </div>
            <span className="text-[14px] font-bold" style={{ fontFamily: 'var(--font-syne)', color: '#E8EDF5' }}>
              Marketplace Hub
            </span>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h2
              className="text-[22px] font-bold"
              style={{ fontFamily: 'var(--font-syne)', color: '#E8EDF5', letterSpacing: '-0.02em' }}
            >
              Bem-vindo de volta
            </h2>
            <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
              Entre na sua conta para continuar
            </p>
          </div>

          {/* Form */}
          <Suspense fallback={
            <div className="space-y-4">
              <div className="shimmer h-10 rounded-lg" />
              <div className="shimmer h-10 rounded-lg" />
              <div className="shimmer h-10 rounded-lg" />
            </div>
          }>
            <LoginForm />
          </Suspense>

        </div>
      </div>

    </div>
  )
}
