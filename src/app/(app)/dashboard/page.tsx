import { Header } from '@/components/layout/header'

export const metadata = {
  title: 'Dashboard — Marketplace Hub',
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        description="Visão geral de todos os canais de venda"
      />
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI cards — implementados na Fase 3 */}
          {[
            { label: 'Receita Total', value: 'R$ —', sub: 'Conecte seus marketplaces' },
            { label: 'Pedidos', value: '—', sub: 'Últimos 30 dias' },
            { label: 'Margem Média', value: '—%', sub: 'Após comissões e impostos' },
            { label: 'Canais Ativos', value: '—', sub: 'De 9 disponíveis' },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg border bg-card p-5 space-y-1"
            >
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.sub}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Configure suas conexões em{' '}
            <a href="/conexoes" className="underline underline-offset-4 hover:text-foreground">
              Conexões
            </a>{' '}
            para ver os dados do dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}
