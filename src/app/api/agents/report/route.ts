import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { gerarRelatorioExecutivo } from '@/lib/ai/groq'
import { countProducts } from '@/lib/db/queries/products'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await getUserWithTenant(authUser.id)
  if (!result) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenantId = result.tenant.id
  const svc = createServiceClient()

  // Buscar dados para o relatório
  const [totalProdutos, alertsData, ordersData] = await Promise.all([
    countProducts(tenantId),
    svc.schema('marketplace').from('agent_alerts')
      .select('alert_type, severity, marketplace, title, description')
      .eq('tenant_id', tenantId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20),
    svc.schema('marketplace').from('orders')
      .select('total_amount, status')
      .eq('tenant_id', tenantId)
      .limit(500),
  ])

  const alerts = (alertsData.data || []).map((a: any) => ({
    tipo: a.alert_type,
    produto: a.title,
    detalhe: a.description || '',
  }))

  const orders = ordersData.data || []
  const receita = orders.filter((o: any) => o.status !== 'cancelled')
    .reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0)
  const totalPedidos = orders.length

  try {
    const content = await gerarRelatorioExecutivo({
      totalProdutos,
      totalPedidos,
      receita,
      margemMedia: 22, // TODO: calcular margem real dos produtos
      alertas: alerts,
      buyboxAlerts: [],
      periodo: 'últimos 30 dias',
    })

    // Salvar o relatório
    const { data: report, error } = await svc
      .schema('marketplace')
      .from('ai_reports')
      .insert({
        tenant_id: tenantId,
        report_type: 'executive',
        content,
        model: 'llama-3.3-70b-versatile',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, report })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao gerar relatório'
    console.error('[agents/report]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
