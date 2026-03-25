// ─── Motor de Precificação ───────────────────────────────────────────────────
import { ALL_FEE_TABLES } from './fee-tables'

export type TaxRegime = 'simples' | 'lucro_presumido' | 'lucro_real' | 'mei'

export const TAX_RATES: Record<TaxRegime, { label: string; defaultRate: number; description: string }> = {
  mei:              { label: 'MEI',              defaultRate: 0,    description: 'Isento de PIS/COFINS/IRPJ' },
  simples:          { label: 'Simples Nacional', defaultRate: 6,    description: 'Alíquota efetiva varia por faixa de receita' },
  lucro_presumido:  { label: 'Lucro Presumido',  defaultRate: 11.33, description: 'PIS 0.65% + COFINS 3% + IRPJ 4.8% + CSLL 2.88%' },
  lucro_real:       { label: 'Lucro Real',       defaultRate: 9.25, description: 'PIS 1.65% + COFINS 7.6%' },
}

export type PricingInput = {
  costPrice: number          // R$ custo do produto
  packaging: number          // R$ embalagem
  freight: number            // R$ frete estimado (do gateway selecionado)
  fixedCosts: number         // R$ custos fixos rateados por produto
  marketplace: string        // slug do marketplace
  category: string           // categoria no marketplace
  listingType?: string       // tipo de anúncio (ML: free/gold_special/gold_premium)
  taxRegime: TaxRegime       // regime tributário
  taxRate?: number           // % override (se quiser customizar)
  desiredMargin: number      // % margem líquida desejada
  includeFreight: boolean    // incluir frete no cálculo?
  includePackaging: boolean  // incluir embalagem no cálculo?
  includeFixedCosts: boolean // incluir custos fixos?
}

export type PricingResult = {
  salePrice: number          // preço sugerido de venda
  commission: number         // R$ comissão do marketplace
  commissionRate: number     // % comissão
  fixedFee: number           // R$ taxa fixa (ex: ML)
  tax: number                // R$ imposto
  taxRate: number            // % imposto
  freight: number            // R$ frete considerado
  packaging: number          // R$ embalagem considerada
  fixedCosts: number         // R$ custos fixos considerados
  grossMargin: number        // R$ margem bruta
  netMargin: number          // R$ margem líquida
  netMarginPct: number       // % margem líquida
  breakEven: number          // preço mínimo para não ter prejuízo
  roi: number                // % ROI sobre custo
  totalCosts: number         // soma de todos os custos
  marketplace: string
  category: string
}

export function calculatePrice(input: PricingInput): PricingResult {
  const table = ALL_FEE_TABLES[input.marketplace]
  if (!table) throw new Error(`Marketplace '${input.marketplace}' não encontrado`)

  const catKey = input.category || table.defaultCategory
  const cat = table.categories[catKey] || table.categories[table.defaultCategory]

  // Taxa de comissão (com multiplicador de tipo de anúncio)
  let commissionRate = cat.commission / 100
  if (input.listingType && table.listingTypes) {
    const lt = table.listingTypes[input.listingType]
    if (lt) commissionRate *= lt.commissionMultiplier
    if (input.listingType === 'free') commissionRate = 0
  }

  // Taxa de imposto
  const taxRate = (input.taxRate ?? TAX_RATES[input.taxRegime].defaultRate) / 100

  // Custos variáveis (R$)
  const freight      = input.includeFreight     ? input.freight      : 0
  const packaging    = input.includePackaging   ? input.packaging    : 0
  const fixedCosts   = input.includeFixedCosts  ? input.fixedCosts   : 0
  const desiredMarginDecimal = input.desiredMargin / 100

  // Fórmula:
  // preço = (custo + embalagem + frete + fixedCosts) / (1 - comissão - imposto - margem)
  const divisor = 1 - commissionRate - taxRate - desiredMarginDecimal
  if (divisor <= 0) {
    // Impossiível atingir margem com essas taxas
    throw new Error('Margem + comissão + imposto ≥ 100%. Reduza a margem desejada.')
  }

  const baseTotal = input.costPrice + packaging + freight + fixedCosts
  const salePrice = baseTotal / divisor

  // Taxa fixa ML
  const fixedFee = (cat.fixedFee && salePrice < (cat.fixedFeeThreshold ?? Infinity))
    ? cat.fixedFee
    : 0

  // Recalcular com taxa fixa incluída
  const salePriceFinal = fixedFee > 0
    ? (baseTotal + fixedFee) / divisor
    : salePrice

  // Breakdown com preço final
  const commissionAmt   = salePriceFinal * commissionRate
  const taxAmt          = salePriceFinal * taxRate
  const grossMargin     = salePriceFinal - commissionAmt - taxAmt - fixedFee
  const netMargin       = grossMargin - packaging - freight - fixedCosts - input.costPrice
  const netMarginPct    = (netMargin / salePriceFinal) * 100
  const totalCosts      = commissionAmt + taxAmt + fixedFee + packaging + freight + fixedCosts + input.costPrice
  const breakEven       = totalCosts / (1 - commissionRate - taxRate)
  const roi             = (netMargin / input.costPrice) * 100

  return {
    salePrice: round2(salePriceFinal),
    commission: round2(commissionAmt),
    commissionRate: round2(commissionRate * 100),
    fixedFee: round2(fixedFee),
    tax: round2(taxAmt),
    taxRate: round2(taxRate * 100),
    freight: round2(freight),
    packaging: round2(packaging),
    fixedCosts: round2(fixedCosts),
    grossMargin: round2(grossMargin),
    netMargin: round2(netMargin),
    netMarginPct: round2(netMarginPct),
    breakEven: round2(breakEven),
    roi: round2(roi),
    totalCosts: round2(totalCosts),
    marketplace: input.marketplace,
    category: catKey,
  }
}

// Calcular preço para múltiplos marketplaces de uma vez
export function calculateAllMarketplaces(
  base: Omit<PricingInput, 'marketplace' | 'category'>,
  marketplaceSlugs: string[]
): Array<{ marketplace: string; error?: string } & Partial<PricingResult>> {
  return marketplaceSlugs.map((slug) => {
    const table = ALL_FEE_TABLES[slug]
    if (!table) return { marketplace: slug, error: 'Marketplace não encontrado' }
    try {
      const result = calculatePrice({ ...base, marketplace: slug, category: table.defaultCategory })
      return { ...result, marketplace: slug }
    } catch (err) {
      return { marketplace: slug, error: err instanceof Error ? err.message : 'Erro' }
    }
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
