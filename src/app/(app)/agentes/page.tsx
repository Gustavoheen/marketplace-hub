import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { createServiceClient } from '@/lib/supabase/service'
import { Header } from '@/components/layout/header'
import { AgentesClient } from './agentes-client'

export const metadata = {
  title: 'Agentes IA — Marketplace Hub',
}

async function getAgentData(tenantId: string) {
  const supabase = createServiceClient()

  const [alertsRes, reportsRes, runsRes] = await Promise.all([
    supabase.schema('marketplace').from('agent_alerts')
      .select('*').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(30),

    supabase.schema('marketplace').from('ai_reports')
      .select('*').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(5),

    supabase.schema('marketplace').from('agent_runs')
      .select('*').eq('tenant_id', tenantId)
      .order('started_at', { ascending: false }).limit(10),
  ])

  return {
    alerts: (alertsRes.data || []) as any[],
    reports: (reportsRes.data || []) as any[],
    runs: (runsRes.data || []) as any[],
  }
}

export default async function AgentesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const result = await getUserWithTenant(authUser.id)
  if (!result) redirect('/login')

  const { alerts, reports, runs } = await getAgentData(result.tenant.id)
  const unread = alerts.filter((a: any) => !a.is_read).length

  return (
    <div className="flex flex-col h-full">
      <Header title="Agentes IA" description="Gestor autônomo de e-commerce" />
      <AgentesClient
        tenantId={result.tenant.id}
        alerts={alerts}
        reports={reports}
        runs={runs}
        unreadCount={unread}
        hasGroqKey={!!process.env.GROQ_API_KEY}
      />
    </div>
  )
}
