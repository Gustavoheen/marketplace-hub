import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserWithTenant } from '@/lib/db/queries/tenants'
import { cookies } from 'next/headers'

const TAX_RATES: Record<string, number> = {
  mei: 0,
  simples: 6,
  simples_nacional: 6,
  lucro_presumido: 11.33,
  lucro_real: 9.25,
}

function getTaxRate(regime: string | null, override: number | null): number {
  if (override != null && override > 0) return override
  return TAX_RATES[regime || 'simples_nacional'] ?? 6
}

const DEFAULT_COMMISSION: Record<string, number> = {
  mercadolivre: 11, shopee: 14, amazon: 15, magalu: 12,
  americanas: 12, casas_bahia: 12, carrefour: 12, shein: 20,
  webcontinental: 12, madeiramadeira: 12, kabum: 13, netshoes: 14,
  bling: 0,
}

function getCommission(mp: string): number {
  const key = (mp || '').toLowerCase().replace(/\s+/g, '')
  return DEFAULT_COMMISSION[key] ?? 12
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '30d'
  const marketplace = searchParams.get('marketplace') || 'all'

  const cookieStore = await cookies()
  let tenantId = cookieStore.get('active_tenant_id')?.value
  if (!tenantId) {
    const result = await getUserWithTenant(user.id)
    if (!result) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })
    tenantId = result.tenant.id
  }

  const svc = createServiceClient()

  let startIso: string
  let endIso: string | null = null

  if (period === 'yesterday') {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    y.setHours(0, 0, 0, 0)
    const yEnd = new Date(y)
    yEnd.setHours(23, 59, 59, 999)
    startIso = y.toISOString()
    endIso = yEnd.toISOString()
  } else {
    const days = period === '1d' ? 1 : period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)
    startIso = startDate.toISOString()
  }

  // ── Fetch orders ──────────────────────────────────────────────────────────
  let ordersQuery = svc
    .schema('marketplace')
    .from('orders')
    .select('total_amount, marketplace, status, order_date, shipping_cost, discount_total, raw_data')
    .eq('tenant_id', tenantId)
    .gte('order_date', startIso)
    .order('order_date', { ascending: true })
    .limit(10000)

  if (endIso) ordersQuery = ordersQuery.lte('order_date', endIso)
  if (marketplace !== 'all') ordersQuery = ordersQuery.eq('marketplace', marketplace as any)

  const [{ data: orders }, { data: tenantData }] = await Promise.all([
    ordersQuery,
    svc.schema('marketplace').from('tenants')
      .select('tax_regime, effective_tax_rate')
      .eq('id', tenantId)
      .single(),
  ])

  const taxRate = getTaxRate(
    tenantData?.tax_regime ?? null,
    tenantData?.effective_tax_rate ? Number(tenantData.effective_tax_rate) : null
  )

  const safeOrders = orders || []

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalRevenue = safeOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
  const totalOrders = safeOrders.length
  const ticketMedio = totalOrders > 0 ? totalRevenue / totalOrders : 0

  let totalCommission = 0
  let totalShipping = 0
  let totalTax = 0
  let estimatedProfit = 0

  for (const o of safeOrders) {
    const amount = Number(o.total_amount || 0)
    const commission = amount * (getCommission(o.marketplace || '') / 100)
    const shipping = Number(o.shipping_cost || 0)
    const tax = amount * (taxRate / 100)
    totalCommission += commission
    totalShipping += shipping
    totalTax += tax
    estimatedProfit += amount - commission - shipping - tax
  }

  const custoOperacional = totalCommission + totalShipping + totalTax
  const margemLiquida = totalRevenue > 0 ? (estimatedProfit / totalRevenue) * 100 : 0

  // ── Trend: receita × custo × lucro por dia ─────────────────────────────────
  const revenueByDay: Record<string, number> = {}
  const costByDay: Record<string, number> = {}
  const profitByDay: Record<string, number> = {}

  for (const o of safeOrders) {
    const day = (o.order_date as string).slice(0, 10)
    const amount = Number(o.total_amount || 0)
    const commission = amount * (getCommission(o.marketplace || '') / 100)
    const shipping = Number(o.shipping_cost || 0)
    const tax = amount * (taxRate / 100)
    const profit = amount - commission - shipping - tax
    const cost = commission + shipping + tax
    revenueByDay[day] = (revenueByDay[day] || 0) + amount
    costByDay[day] = (costByDay[day] || 0) + cost
    profitByDay[day] = (profitByDay[day] || 0) + profit
  }

  const trendDays = Math.ceil((new Date(endIso ?? new Date()).getTime() - new Date(startIso).getTime()) / 86400000) || 1
  const trend: Array<{ date: string; revenue: number; cost: number; profit: number }> = []
  for (let d = 0; d < trendDays; d++) {
    const dt = new Date(startIso)
    dt.setDate(dt.getDate() + d)
    const key = dt.toISOString().slice(0, 10)
    trend.push({
      date: key,
      revenue: revenueByDay[key] || 0,
      cost: costByDay[key] || 0,
      profit: profitByDay[key] || 0,
    })
  }

  // ── Composição de Custos ───────────────────────────────────────────────────
  const outros = totalTax
  const costComposition = [
    { name: 'Comissões', value: Math.round(totalCommission * 100) / 100 },
    { name: 'Frete', value: Math.round(totalShipping * 100) / 100 },
    { name: 'Impostos', value: Math.round(outros * 100) / 100 },
  ].filter(c => c.value > 0)

  // ── Métodos de Pagamento ─────────────────────────────────────────────────
  // Try to extract from raw_data->formasPagamento or raw_data->formaPagamento
  const paymentMap: Record<string, { count: number; total: number }> = {}
  for (const o of safeOrders) {
    const raw = o.raw_data as any
    const amount = Number(o.total_amount || 0)
    let method: string | null = null

    if (raw) {
      // Bling v3 format
      if (raw.formasPagamento && Array.isArray(raw.formasPagamento) && raw.formasPagamento.length > 0) {
        method = raw.formasPagamento[0]?.descricao || raw.formasPagamento[0]?.tipo || null
      } else if (raw.formaPagamento) {
        method = typeof raw.formaPagamento === 'string'
          ? raw.formaPagamento
          : raw.formaPagamento?.descricao || raw.formaPagamento?.tipo || null
      } else if (raw.pagamentos && Array.isArray(raw.pagamentos) && raw.pagamentos.length > 0) {
        method = raw.pagamentos[0]?.forma?.descricao || raw.pagamentos[0]?.descricao || null
      }
    }

    const key = method ? normalizePayment(method) : 'Outros'
    if (!paymentMap[key]) paymentMap[key] = { count: 0, total: 0 }
    paymentMap[key].count += 1
    paymentMap[key].total += amount
  }

  const paymentMethods = Object.entries(paymentMap)
    .map(([name, v]) => ({
      name,
      count: v.count,
      total: Math.round(v.total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total)

  return NextResponse.json({
    kpis: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      lucroLiquido: Math.round(estimatedProfit * 100) / 100,
      custoOperacional: Math.round(custoOperacional * 100) / 100,
      ticketMedio: Math.round(ticketMedio * 100) / 100,
      margemLiquida: Math.round(margemLiquida * 100) / 100,
      totalCommission: Math.round(totalCommission * 100) / 100,
      totalShipping: Math.round(totalShipping * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      taxRate,
      totalOrders,
    },
    trend,
    costComposition,
    paymentMethods,
  })
}

function normalizePayment(raw: string): string {
  const s = raw.toLowerCase()
  if (s.includes('pix')) return 'PIX'
  if (s.includes('débito') || s.includes('debito')) return 'Cartão Débito'
  if (s.includes('crédito') || s.includes('credito')) return 'Cartão Crédito'
  if (s.includes('boleto')) return 'Boleto'
  if (s.includes('dinheiro')) return 'Dinheiro'
  if (s.includes('vale')) return 'Vale'
  return raw.length > 20 ? raw.slice(0, 20) : raw
}
