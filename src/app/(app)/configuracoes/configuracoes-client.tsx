'use client'

import { useState } from 'react'
import { Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  tenant: {
    id: string
    name: string
    slug: string
    tax_regime?: string | null
    effective_tax_rate?: number | null
  } | null
}

const REGIME_OPTIONS = [
  { value: 'mei',               label: 'MEI',                      aliquota: 0,     desc: 'Microempreendedor Individual — isento de IRPJ/CSLL' },
  { value: 'simples_nacional',  label: 'Simples Nacional',         aliquota: 6,     desc: 'Alíquota média de 6% (varia conforme faturamento)' },
  { value: 'lucro_presumido',   label: 'Lucro Presumido',          aliquota: 11.33, desc: 'PIS + COFINS + IRPJ + CSLL ≈ 11,33%' },
  { value: 'lucro_real',        label: 'Lucro Real',               aliquota: 9.25,  desc: 'PIS não-cumulativo + COFINS não-cumulativo ≈ 9,25%' },
]

export function ConfiguracoesClient({ tenant }: Props) {
  const [regime, setRegime]       = useState(tenant?.tax_regime ?? 'simples_nacional')
  const [aliquota, setAliquota]   = useState(String(tenant?.effective_tax_rate ?? ''))
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState('')
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState('')

  const defaultAliquota = REGIME_OPTIONS.find(r => r.value === regime)?.aliquota ?? 6

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/tenant/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tax_regime: regime,
          effective_tax_rate: aliquota === '' ? null : Number(aliquota),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleBackfill() {
    setBackfilling(true)
    setBackfillMsg('')
    try {
      const res = await fetch('/api/admin/backfill-status', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro no backfill')
      setBackfillMsg(`✓ ${data.updated} pedidos corrigidos`)
    } catch (e: any) {
      setBackfillMsg(`Erro: ${e.message}`)
    } finally {
      setBackfilling(false)
    }
  }

  const selected = REGIME_OPTIONS.find(r => r.value === regime)

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24 md:pb-6">

      {/* ── Regime tributário ── */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h2 className="text-[14px] font-semibold" style={{ color: '#E8EDF5' }}>Regime Tributário</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REGIME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setRegime(opt.value); if (!aliquota) {} }}
              className="text-left rounded-xl p-4 transition-all"
              style={{
                background: regime === opt.value ? 'rgba(6,200,217,0.08)' : 'rgba(255,255,255,0.03)',
                border: regime === opt.value ? '1px solid rgba(6,200,217,0.35)' : '1px solid var(--border)',
              }}
            >
              <p className="text-[13px] font-semibold" style={{ color: regime === opt.value ? 'var(--cyan)' : '#E8EDF5' }}>
                {opt.label}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--muted-foreground)' }}>{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Alíquota efetiva ── */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div>
          <h2 className="text-[14px] font-semibold" style={{ color: '#E8EDF5' }}>Alíquota Efetiva</h2>
          <p className="text-[12px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Sobrescreve a alíquota padrão do regime ({defaultAliquota}%) para cálculos de lucro.
            Útil para o Simples Nacional, cuja alíquota sobe conforme o faturamento.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-[200px]">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={aliquota}
              onChange={e => setAliquota(e.target.value)}
              placeholder={String(defaultAliquota)}
              className="w-full rounded-lg px-4 py-2.5 pr-8 text-[14px] font-mono"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                color: '#E8EDF5',
                outline: 'none',
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] pointer-events-none" style={{ color: 'var(--muted-foreground)' }}>%</span>
          </div>

          {aliquota && (
            <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: 'rgba(6,200,217,0.08)', border: '1px solid rgba(6,200,217,0.2)', color: 'var(--cyan)' }}>
              Usando {aliquota}% (padrão: {defaultAliquota}%)
            </div>
          )}
        </div>

        <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
          Tabela Simples Nacional 2025 — Anexo I (comércio): até R$180k → 4% · até R$360k → 7,3% · até R$720k → 9,5% · até R$1,8M → 10,7% · até R$3,6M → 14,3%
        </p>
      </div>

      {/* ── Ações ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all disabled:opacity-50"
          style={{ background: 'var(--cyan)', color: '#000' }}
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando...' : 'Salvar'}
        </button>

        {saved && (
          <div className="flex items-center gap-2 text-[13px]" style={{ color: '#10D48A' }}>
            <CheckCircle className="h-4 w-4" />
            Salvo com sucesso
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-[13px]" style={{ color: '#F87171' }}>
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      {/* ── Manutenção: backfill de status ── */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h2 className="text-[14px] font-semibold" style={{ color: '#E8EDF5' }}>Manutenção de Dados</h2>
        <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
          Corrige pedidos com status incorreto ("unknown") usando os dados originais do Bling.
          Execute após sincronizar o Bling pela primeira vez ou após uma atualização do sistema.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackfill}
            disabled={backfilling}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold transition-all disabled:opacity-50"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#A855F7' }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${backfilling ? 'animate-spin' : ''}`} />
            {backfilling ? 'Corrigindo...' : 'Corrigir Status dos Pedidos'}
          </button>
          {backfillMsg && (
            <span className="text-[12px]" style={{ color: backfillMsg.startsWith('Erro') ? '#F87171' : '#10D48A' }}>
              {backfillMsg}
            </span>
          )}
        </div>
      </div>

    </div>
  )
}
