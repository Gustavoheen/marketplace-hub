'use client'

import { useState, useMemo } from 'react'
import {
  Calculator, Package, Truck, Tag, Percent,
  ToggleLeft, ToggleRight, ChevronDown, Info,
  TrendingUp, TrendingDown, AlertTriangle, Check,
  Zap, ShoppingBag,
} from 'lucide-react'
import { calculateAllMarketplaces } from '@/lib/pricing/engine'
import type { TaxRegime } from '@/lib/pricing/engine'

type MarketplaceInfo = {
  slug: string
  name: string
  categories: { key: string; label: string; commission: number }[]
  listingTypes?: { key: string; label: string }[]
  defaultCategory: string
  notes?: string
}

type TaxRegimeInfo = {
  key: string
  label: string
  defaultRate: number
  description: string
}

// ─── Gateways de frete (mockados — integrar Melhor Envio / Frenet depois) ──────

const FREIGHT_GATEWAYS = [
  { id: 'manual',        label: 'Valor manual',      color: '#94A3B8' },
  { id: 'melhor_envio',  label: 'Melhor Envio',       color: '#06C8D9' },
  { id: 'frenet',        label: 'Frenet',             color: '#818CF8' },
  { id: 'correios',      label: 'Correios',           color: '#10D48A' },
  { id: 'jadlog',        label: 'Jadlog',             color: '#F59E0B' },
  { id: 'loggi',         label: 'Loggi',              color: '#F97316' },
]

// ─── Cores por marketplace ────────────────────────────────────────────────────

const MP_COLORS: Record<string, string> = {
  mercadolivre: '#F59E0B',
  shopee:       '#F97316',
  amazon:       '#F59E0B',
  magalu:       '#3B82F6',
  americanas:   '#EF4444',
  casas_bahia:  '#10D48A',
  carrefour:    '#3B82F6',
  shein:        '#EC4899',
  webcontinental:'#818CF8',
  madeiramadeira:'#A78BFA',
  kabum:        '#06C8D9',
  netshoes:     '#10D48A',
}

// ─── Componente de toggle ─────────────────────────────────────────────────────

function Toggle({ active, onToggle, label, color = 'var(--cyan)' }: {
  active: boolean; onToggle: () => void; label: string; color?: string
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium transition-all"
      style={{
        background: active ? `${color}18` : 'rgba(255,255,255,0.03)',
        border: active ? `1px solid ${color}40` : '1px solid var(--sidebar-border)',
        color: active ? color : 'var(--muted-foreground)',
      }}
    >
      {active
        ? <ToggleRight className="h-3.5 w-3.5" />
        : <ToggleLeft className="h-3.5 w-3.5" />
      }
      {label}
    </button>
  )
}

// ─── Input numérico ───────────────────────────────────────────────────────────

function NumInput({ label, value, onChange, prefix = 'R$', suffix, min = 0, step = 0.01, hint }: {
  label: string; value: number; onChange: (v: number) => void
  prefix?: string; suffix?: string; min?: number; step?: number; hint?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
        {label}
        {hint && <span className="ml-1" style={{ color: 'var(--sidebar-border)' }} title={hint}>ⓘ</span>}
      </label>
      <div
        className="flex items-center gap-1.5 rounded-lg px-3 py-2"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--sidebar-border)' }}
      >
        {prefix && <span className="text-[11px] shrink-0" style={{ color: 'var(--muted-foreground)' }}>{prefix}</span>}
        <input
          type="number"
          min={min}
          step={step}
          value={value || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 bg-transparent text-[13px] font-mono outline-none"
          style={{ color: '#E8EDF5' }}
          placeholder="0"
        />
        {suffix && <span className="text-[11px] shrink-0" style={{ color: 'var(--muted-foreground)' }}>{suffix}</span>}
      </div>
    </div>
  )
}

// ─── Card de resultado por marketplace ───────────────────────────────────────

function ResultCard({ mp, result, name }: {
  mp: string
  result: any
  name: string
}) {
  const [open, setOpen] = useState(false)
  const color = MP_COLORS[mp] || '#94A3B8'

  if (result.error) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: 'var(--rose)' }} />
          <span className="text-[12px] font-semibold" style={{ color: '#E8EDF5' }}>{name}</span>
        </div>
        <p className="mt-2 text-[11px]" style={{ color: 'var(--rose)' }}>{result.error}</p>
      </div>
    )
  }

  const isGoodMargin = result.netMarginPct >= 15
  const isWarningMargin = result.netMarginPct >= 5 && result.netMarginPct < 15
  const marginColor = isGoodMargin ? 'var(--emerald)' : isWarningMargin ? 'var(--amber)' : 'var(--rose)'

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: 'var(--card)',
        border: `1px solid ${color}25`,
        boxShadow: `0 0 16px ${color}08`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold shrink-0"
            style={{ background: `${color}18`, color }}
          >
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-[12px] font-semibold" style={{ color: '#E8EDF5' }}>{name}</p>
            <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              {result.commissionRate}% comissão
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-bold font-mono" style={{ color: '#E8EDF5' }}>
            {fmt(result.salePrice)}
          </p>
          <div className="flex items-center justify-end gap-1">
            {isGoodMargin ? <TrendingUp className="h-3 w-3" style={{ color: marginColor }} />
              : <TrendingDown className="h-3 w-3" style={{ color: marginColor }} />}
            <span className="text-[11px] font-semibold" style={{ color: marginColor }}>
              {result.netMarginPct.toFixed(1)}% margem
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      {open && (
        <div
          className="border-t px-4 pb-4 pt-3 space-y-2"
          style={{ borderColor: `${color}20`, background: `${color}05` }}
        >
          {[
            { label: 'Comissão',      value: result.commission,  pct: result.commissionRate },
            { label: 'Imposto',       value: result.tax,         pct: result.taxRate },
            result.fixedFee > 0 && { label: 'Taxa fixa',    value: result.fixedFee,    pct: null },
            result.freight > 0 && { label: 'Frete',         value: result.freight,     pct: null },
            result.packaging > 0 && { label: 'Embalagem',   value: result.packaging,   pct: null },
            result.fixedCosts > 0 && { label: 'Custos fixos', value: result.fixedCosts, pct: null },
            { label: 'Custo produto', value: null, raw: result.salePrice - result.grossMargin },
          ].filter(Boolean).map((row: any) => (
            <div key={row.label} className="flex items-center justify-between text-[11px]">
              <span style={{ color: 'var(--muted-foreground)' }}>{row.label}</span>
              <span style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>
                {row.pct != null ? `${row.pct.toFixed(1)}% · ` : ''}
                {fmt(row.value ?? row.raw)}
              </span>
            </div>
          ))}
          <div className="border-t pt-2 mt-1" style={{ borderColor: `${color}20` }}>
            <div className="flex items-center justify-between text-[12px] font-semibold">
              <span style={{ color: '#E8EDF5' }}>Margem líquida</span>
              <span style={{ color: marginColor, fontFamily: 'var(--font-jetbrains-mono)' }}>
                {fmt(result.netMargin)} ({result.netMarginPct.toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span style={{ color: 'var(--muted-foreground)' }}>Break-even</span>
              <span style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                {fmt(result.breakEven)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: 'var(--muted-foreground)' }}>ROI sobre custo</span>
              <span style={{ color: result.roi > 0 ? 'var(--emerald)' : 'var(--rose)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                {result.roi.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer quick bar */}
      <div
        className="flex items-center gap-3 px-4 py-2 text-[10px]"
        style={{ borderTop: `1px solid ${color}15`, background: `${color}06` }}
      >
        <span style={{ color: 'var(--muted-foreground)' }}>
          Break-even: <span style={{ color: '#E8EDF5', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmt(result.breakEven)}</span>
        </span>
        <span style={{ color: 'var(--muted-foreground)' }}>
          ROI: <span style={{ color: result.roi > 0 ? 'var(--emerald)' : 'var(--rose)', fontFamily: 'var(--font-jetbrains-mono)' }}>{result.roi.toFixed(1)}%</span>
        </span>
        <ChevronDown
          className="ml-auto h-3 w-3 transition-transform cursor-pointer"
          style={{ color: 'var(--muted-foreground)', transform: open ? 'rotate(180deg)' : 'none' }}
          onClick={() => setOpen((v) => !v)}
        />
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function PrecificacaoClient({
  marketplaces,
  taxRegimes,
}: {
  marketplaces: MarketplaceInfo[]
  taxRegimes: TaxRegimeInfo[]
}) {
  // Inputs
  const [costPrice,    setCostPrice]    = useState(0)
  const [packaging,    setPackaging]    = useState(0)
  const [freight,      setFreight]      = useState(0)
  const [fixedCosts,   setFixedCosts]   = useState(0)
  const [desiredMargin, setDesiredMargin] = useState(20)
  const [taxRegime,    setTaxRegime]    = useState<TaxRegime>('simples')
  const [taxRateOverride, setTaxRateOverride] = useState<number | null>(null)

  // Toggles de custo
  const [includeFreight,     setIncludeFreight]     = useState(true)
  const [includePackaging,   setIncludePackaging]   = useState(true)
  const [includeFixedCosts,  setIncludeFixedCosts]  = useState(false)
  const [selectedGateway,    setSelectedGateway]    = useState('manual')

  // Marketplaces selecionados
  const [selectedMps, setSelectedMps] = useState<Set<string>>(
    new Set(['mercadolivre', 'shopee', 'amazon', 'magalu'])
  )

  const toggleMp = (slug: string) => {
    setSelectedMps((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const currentTaxRate = taxRateOverride ?? taxRegimes.find((t) => t.key === taxRegime)?.defaultRate ?? 0

  // Calcular para todos os marketplaces selecionados
  const results = useMemo(() => {
    if (costPrice <= 0) return []
    try {
      return calculateAllMarketplaces(
        {
          costPrice,
          packaging,
          freight,
          fixedCosts,
          taxRegime,
          taxRate: taxRateOverride ?? undefined,
          desiredMargin,
          includeFreight,
          includePackaging,
          includeFixedCosts,
        },
        Array.from(selectedMps)
      )
    } catch {
      return []
    }
  }, [costPrice, packaging, freight, fixedCosts, taxRegime, taxRateOverride, desiredMargin,
      includeFreight, includePackaging, includeFixedCosts, selectedMps])

  const bestMp = results.reduce((best: any, r: any) =>
    (!r.error && (!best || r.netMarginPct > (best?.netMarginPct ?? -Infinity))) ? r : best, null)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 overflow-hidden">

        {/* ── Painel de inputs (esquerda) ─────────────────────────────── */}
        <div
          className="w-[320px] shrink-0 flex flex-col overflow-y-auto p-5 space-y-5"
          style={{ borderRight: '1px solid var(--sidebar-border)' }}
        >

          {/* Dados do produto */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-3.5 w-3.5" style={{ color: 'var(--cyan)' }} />
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-syne)' }}>
                Produto
              </p>
            </div>
            <NumInput label="Custo do produto *" value={costPrice} onChange={setCostPrice}
              hint="Custo de aquisição ou fabricação" />
            <NumInput label="Margem desejada" value={desiredMargin} onChange={setDesiredMargin}
              prefix="" suffix="%" step={0.5} hint="Margem líquida após todos os custos" />
          </div>

          {/* Regime tributário */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Percent className="h-3.5 w-3.5" style={{ color: 'var(--amber)' }} />
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-syne)' }}>
                Regime Tributário
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {taxRegimes.map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setTaxRegime(t.key as TaxRegime); setTaxRateOverride(null) }}
                  className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-left transition-all"
                  style={{
                    background: taxRegime === t.key ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                    border: taxRegime === t.key ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--sidebar-border)',
                    color: taxRegime === t.key ? 'var(--amber)' : 'var(--muted-foreground)',
                  }}
                >
                  {t.label}
                  <span className="block text-[10px] opacity-70">{t.defaultRate}%</span>
                </button>
              ))}
            </div>
            <NumInput
              label="Alíquota customizada (opcional)"
              value={taxRateOverride ?? currentTaxRate}
              onChange={(v) => setTaxRateOverride(v)}
              prefix="" suffix="%"
              hint="Substitui a alíquota do regime selecionado"
            />
          </div>

          {/* Custos adicionais com toggles */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5" style={{ color: '#818CF8' }} />
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-syne)' }}>
                Custos Adicionais
              </p>
            </div>

            {/* Embalagem */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Embalagem</label>
                <Toggle active={includePackaging} onToggle={() => setIncludePackaging((v) => !v)} label="" color="#818CF8" />
              </div>
              <NumInput label="" value={packaging} onChange={setPackaging} />
            </div>

            {/* Frete */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Frete</label>
                <Toggle active={includeFreight} onToggle={() => setIncludeFreight((v) => !v)} label="" color="var(--cyan)" />
              </div>
              {/* Gateway selector */}
              <div className="flex flex-wrap gap-1.5">
                {FREIGHT_GATEWAYS.map((gw) => (
                  <button
                    key={gw.id}
                    onClick={() => setSelectedGateway(gw.id)}
                    className="rounded px-2 py-1 text-[10px] font-medium transition-all"
                    style={{
                      background: selectedGateway === gw.id ? `${gw.color}18` : 'rgba(255,255,255,0.03)',
                      border: selectedGateway === gw.id ? `1px solid ${gw.color}40` : '1px solid var(--sidebar-border)',
                      color: selectedGateway === gw.id ? gw.color : 'var(--muted-foreground)',
                    }}
                  >
                    {gw.label}
                  </button>
                ))}
              </div>
              <NumInput label="" value={freight} onChange={setFreight} hint="Valor médio de frete por produto" />
            </div>

            {/* Custos fixos */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Custos Fixos Rateados</label>
                <Toggle active={includeFixedCosts} onToggle={() => setIncludeFixedCosts((v) => !v)} label="" color="var(--emerald)" />
              </div>
              <NumInput label="" value={fixedCosts} onChange={setFixedCosts}
                hint="Valor de custos fixos rateado por produto" />
            </div>
          </div>
        </div>

        {/* ── Painel direito ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Seletor de marketplaces */}
          <div
            className="px-5 py-3 flex flex-wrap items-center gap-2 shrink-0"
            style={{ borderBottom: '1px solid var(--sidebar-border)' }}
          >
            <ShoppingBag className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            <span className="text-[11px] font-medium mr-1" style={{ color: 'var(--muted-foreground)' }}>
              Calcular em:
            </span>
            {marketplaces.map((mp) => {
              const color = MP_COLORS[mp.slug] || '#94A3B8'
              const active = selectedMps.has(mp.slug)
              return (
                <button
                  key={mp.slug}
                  onClick={() => toggleMp(mp.slug)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all"
                  style={{
                    background: active ? `${color}18` : 'rgba(255,255,255,0.03)',
                    border: active ? `1px solid ${color}40` : '1px solid var(--sidebar-border)',
                    color: active ? color : 'var(--muted-foreground)',
                  }}
                >
                  {active && <Check className="h-3 w-3" />}
                  {mp.name}
                </button>
              )
            })}
          </div>

          {/* Resultados */}
          <div className="flex-1 overflow-y-auto p-5">
            {costPrice <= 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-3">
                  <div
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl"
                    style={{ background: 'rgba(6,200,217,0.08)', border: '1px solid rgba(6,200,217,0.15)' }}
                  >
                    <Calculator className="h-7 w-7" style={{ color: 'var(--cyan)' }} />
                  </div>
                  <p className="font-semibold" style={{ color: '#E8EDF5', fontFamily: 'var(--font-syne)' }}>
                    Informe o custo do produto
                  </p>
                  <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
                    A calculadora mostrará o preço ideal por marketplace.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">

                {/* Melhor canal */}
                {bestMp && !bestMp.error && (
                  <div
                    className="flex items-center gap-3 rounded-xl px-5 py-3"
                    style={{ background: 'rgba(16,212,138,0.08)', border: '1px solid rgba(16,212,138,0.2)' }}
                  >
                    <Zap className="h-4 w-4 shrink-0" style={{ color: 'var(--emerald)' }} />
                    <p className="text-[13px]" style={{ color: '#E8EDF5' }}>
                      Melhor canal: <span className="font-bold" style={{ color: 'var(--emerald)' }}>
                        {marketplaces.find((m) => m.slug === bestMp.marketplace)?.name}
                      </span>{' '}
                      com {bestMp.netMarginPct.toFixed(1)}% de margem líquida ({fmt(bestMp.salePrice)})
                    </p>
                  </div>
                )}

                {/* Grid de resultados */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {results.map((r: any) => (
                    <ResultCard
                      key={r.marketplace}
                      mp={r.marketplace}
                      result={r}
                      name={marketplaces.find((m) => m.slug === r.marketplace)?.name ?? r.marketplace}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '—'
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
