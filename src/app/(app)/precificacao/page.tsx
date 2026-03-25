import { Header } from '@/components/layout/header'
import { PrecificacaoClient } from './precificacao-client'
import { ALL_FEE_TABLES } from '@/lib/pricing/fee-tables'
import { TAX_RATES } from '@/lib/pricing/engine'

export const metadata = {
  title: 'Precificação — Marketplace Hub',
}

export default function PrecificacaoPage() {
  const marketplaces = Object.entries(ALL_FEE_TABLES).map(([slug, table]) => ({
    slug,
    name: table.name,
    categories: Object.entries(table.categories).map(([key, cat]) => ({
      key,
      label: cat.label,
      commission: cat.commission,
    })),
    listingTypes: table.listingTypes
      ? Object.entries(table.listingTypes).map(([key, lt]) => ({ key, label: lt.label }))
      : undefined,
    defaultCategory: table.defaultCategory,
    notes: table.notes,
  }))

  const taxRegimes = Object.entries(TAX_RATES).map(([key, val]) => ({
    key,
    label: val.label,
    defaultRate: val.defaultRate,
    description: val.description,
  }))

  return (
    <div className="flex flex-col h-full">
      <Header title="Precificação" description="Calculadora por marketplace" />
      <PrecificacaoClient marketplaces={marketplaces} taxRegimes={taxRegimes} />
    </div>
  )
}
