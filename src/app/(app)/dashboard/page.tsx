import { Header } from '@/components/layout/header'
import { DashboardClient } from './dashboard-client'

export const metadata = {
  title: 'Dashboard — Marketplace Hub',
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" description="Visão consolidada de todos os canais" />
      <DashboardClient />
    </div>
  )
}
