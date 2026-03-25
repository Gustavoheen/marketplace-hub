'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot, Zap, AlertTriangle, TrendingDown, TrendingUp,
  ShoppingBag, RefreshCw, CheckCircle2, Clock,
  Eye, EyeOff, Play, Sparkles, BarChart2, Bell,
  Package, Activity,
} from 'lucide-react'

type Alert = {
  id: string
  alert_type: string
  severity: string
  marketplace?: string
  title: string
  description?: string
  is_read: boolean
  created_at: string
  data?: any
}

type Report = {
  id: string
  report_type: string
  content: string
  created_at: string
  model?: string
}

type Run = {
  id: string
  agent_type: string
  status: string
  products_checked: number
  alerts_created: number
  started_at: string
  finished_at?: string
}

const SEVERITY_CONFIG = {
  critical: { color: 'var(--rose)',    bg: 'rgba(244,63,94,0.08)',  border: 'rgba(244,63,94,0.2)',  label: 'Crítico'  },
  high:     { color: 'var(--amber)',   bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'Alto'     },
  medium:   { color: '#818CF8',        bg: 'rgba(129,140,248,0.08)',border: 'rgba(129,140,248,0.2)',label: 'Médio'    },
  low:      { color: 'var(--emerald)', bg: 'rgba(16,212,138,0.08)', border: 'rgba(16,212,138,0.2)', label: 'Baixo'   },
}

const ALERT_ICONS: Record<string, any> = {
  negative_margin:   TrendingDown,
  buybox_lost:       ShoppingBag,
  buybox_gained:     TrendingUp,
  price_opportunity: Zap,
  catalog_drop:      BarChart2,
  low_stock:         Package,
}

const ALERT_LABELS: Record<string, string> = {
  negative_margin:   'Margem Negativa',
  buybox_lost:       'Buybox Perdido',
  buybox_gained:     'Buybox Ganho',
  price_opportunity: 'Oportunidade de Preço',
  catalog_drop:      'Queda no Catálogo',
  low_stock:         'Estoque Baixo',
}

const AGENT_LABELS: Record<string, string> = {
  profit_watcher:      'Profit Watcher',
  buybox_monitor:      'Monitor de Buybox',
  price_analyzer:      'Analisador de Preços',
  report_generator:    'Relatório Executivo',
}

function AlertCard({ alert, onMarkRead }: { alert: Alert; onMarkRead: (id: string) => void }) {
  const cfg = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.medium
  const Icon = ALERT_ICONS[alert.alert_type] || AlertTriangle
  const timeAgo = getTimeAgo(alert.created_at)

  return (
    <div
      className="flex items-start gap-3 rounded-xl p-4 transition-all"
      style={{
        background: alert.is_read ? 'rgba(255,255,255,0.02)' : cfg.bg,
        border: `1px solid ${alert.is_read ? 'var(--sidebar-border)' : cfg.border}`,
        opacity: alert.is_read ? 0.6 : 1,
      }}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5"
        style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}
      >
        <Icon className="h-4 w-4" style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[13px] font-semibold" style={{ color: '#E8EDF5' }}>{alert.title}</p>
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
              >
                {cfg.label}
              </span>
              {alert.marketplace && (
                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  {alert.marketplace}
                </span>
              )}
            </div>
            {alert.description && (
              <p className="mt-0.5 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                {alert.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{timeAgo}</span>
            {!alert.is_read && (
              <button
                onClick={() => onMarkRead(alert.id)}
                className="h-6 w-6 flex items-center justify-center rounded transition-all"
                style={{ color: 'var(--muted-foreground)' }}
                title="Marcar como lido"
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--emerald)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)' }}
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportCard({ report }: { report: Report }) {
  const [expanded, setExpanded] = useState(false)
  const preview = report.content.slice(0, 200)

  return (
    <div
      className="rounded-xl p-5 space-y-3"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: 'var(--cyan)' }} />
          <span className="text-[12px] font-semibold" style={{ color: '#E8EDF5' }}>
            Relatório Executivo
          </span>
        </div>
        <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
          {new Date(report.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div
        className="text-[12px] leading-relaxed whitespace-pre-wrap"
        style={{ color: '#94A3B8' }}
      >
        {expanded ? report.content : preview + (report.content.length > 200 ? '...' : '')}
      </div>
      {report.content.length > 200 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] font-medium transition-colors"
          style={{ color: 'var(--cyan)' }}
        >
          {expanded ? 'Ver menos' : 'Ver relatório completo'}
        </button>
      )}
    </div>
  )
}

export function AgentesClient({
  tenantId,
  alerts,
  reports,
  runs,
  unreadCount,
  hasGroqKey,
}: {
  tenantId: string
  alerts: Alert[]
  reports: Report[]
  runs: Run[]
  unreadCount: number
  hasGroqKey: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [tab, setTab] = useState<'alerts' | 'reports' | 'runs'>('alerts')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRunning, setIsRunning] = useState<string | null>(null)
  const [localAlerts, setLocalAlerts] = useState(alerts)
  const [localReports, setLocalReports] = useState(reports)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerateReport() {
    setIsGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/agents/report', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setLocalReports([data.report, ...localReports])
        setTab('reports')
      } else {
        setError(data.error || 'Erro ao gerar relatório')
      }
    } catch {
      setError('Erro de conexão')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleRunAgent(agentType: string) {
    setIsRunning(agentType)
    setError(null)
    try {
      const res = await fetch(`/api/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType }),
      })
      const data = await res.json()
      if (res.ok) {
        startTransition(() => router.refresh())
      } else {
        setError(data.error || 'Erro ao executar agente')
      }
    } catch {
      setError('Erro de conexão')
    } finally {
      setIsRunning(null)
    }
  }

  async function handleMarkRead(id: string) {
    setLocalAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_read: true } : a))
    await fetch('/api/agents/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  const unread = localAlerts.filter((a) => !a.is_read).length
  const criticalCount = localAlerts.filter((a) => a.severity === 'critical' && !a.is_read).length

  const tabs = [
    { key: 'alerts',  label: 'Alertas',   count: unread, icon: Bell },
    { key: 'reports', label: 'Relatórios', count: localReports.length, icon: Sparkles },
    { key: 'runs',    label: 'Execuções',  count: runs.length, icon: Activity },
  ] as const

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Top bar */}
      <div
        className="flex items-center gap-4 px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        {/* Status dos agentes */}
        <div className="flex items-center gap-3 flex-1">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: 'rgba(16,212,138,0.08)', border: '1px solid rgba(16,212,138,0.15)' }}
          >
            <span className="live-dot h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--emerald)' }} />
            <span className="text-[12px] font-medium" style={{ color: 'var(--emerald)' }}>Agentes ativos</span>
          </div>

          {criticalCount > 0 && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}
            >
              <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--rose)' }} />
              <span className="text-[12px] font-medium" style={{ color: 'var(--rose)' }}>
                {criticalCount} alertas críticos
              </span>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2">
          {!hasGroqKey && (
            <a
              href="/configuracoes"
              className="text-[11px] px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--amber)' }}
            >
              ⚠ Configure GROQ_API_KEY
            </a>
          )}

          <button
            onClick={() => handleRunAgent('buybox_monitor')}
            disabled={!!isRunning}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-all disabled:opacity-60"
            style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', color: '#818CF8' }}
          >
            <Play className={`h-3.5 w-3.5 ${isRunning === 'buybox_monitor' ? 'animate-pulse' : ''}`} />
            Monitor Buybox
          </button>

          <button
            onClick={handleGenerateReport}
            disabled={isGenerating || !hasGroqKey}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-all disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, rgba(6,200,217,0.15) 0%, rgba(129,140,248,0.15) 100%)',
              border: '1px solid rgba(6,200,217,0.3)',
              color: 'var(--cyan)',
            }}
          >
            <Sparkles className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Gerando...' : 'Gerar Relatório IA'}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="mx-6 mt-3 px-4 py-2 rounded-lg text-[12px]"
          style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--rose)' }}
        >
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-0 shrink-0">
        {tabs.map(({ key, label, count, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-[12px] font-medium transition-all"
            style={{
              background: tab === key ? 'var(--card)' : 'transparent',
              border: tab === key ? '1px solid var(--border)' : '1px solid transparent',
              borderBottom: tab === key ? '1px solid var(--card)' : '1px solid transparent',
              color: tab === key ? '#E8EDF5' : 'var(--muted-foreground)',
              marginBottom: tab === key ? '-1px' : '0',
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {count > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-bold min-w-[18px] text-center"
                style={{
                  background: key === 'alerts' && unread > 0 ? 'var(--cyan)' : 'rgba(255,255,255,0.1)',
                  color: key === 'alerts' && unread > 0 ? '#07090F' : 'var(--muted-foreground)',
                }}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div
        className="flex-1 overflow-y-auto p-6"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--card)', borderRadius: '0 0.5rem 0.5rem 0.5rem' }}
      >

        {/* Tab: Alertas */}
        {tab === 'alerts' && (
          <div className="space-y-3">
            {localAlerts.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="Nenhum alerta ainda"
                desc="Execute o Monitor de Buybox ou o Profit Watcher para começar a monitorar seus produtos."
              />
            ) : (
              localAlerts.map((a) => (
                <AlertCard key={a.id} alert={a} onMarkRead={handleMarkRead} />
              ))
            )}
          </div>
        )}

        {/* Tab: Relatórios */}
        {tab === 'reports' && (
          <div className="space-y-4">
            {localReports.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Nenhum relatório gerado"
                desc={hasGroqKey ? 'Clique em "Gerar Relatório IA" para criar um relatório executivo.' : 'Configure a GROQ_API_KEY em Configurações para ativar a IA.'}
              />
            ) : (
              localReports.map((r) => (
                <ReportCard key={r.id} report={r} />
              ))
            )}
          </div>
        )}

        {/* Tab: Execuções */}
        {tab === 'runs' && (
          <div className="space-y-3">
            {runs.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Nenhuma execução ainda"
                desc="Os agentes são executados automaticamente via cron ou manualmente clicando nos botões acima."
              />
            ) : (
              runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center gap-4 rounded-xl px-5 py-4"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--sidebar-border)' }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                    style={{
                      background: run.status === 'completed' ? 'rgba(16,212,138,0.12)' : run.status === 'failed' ? 'rgba(244,63,94,0.12)' : 'rgba(6,200,217,0.12)',
                    }}
                  >
                    {run.status === 'completed' ? <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--emerald)' }} />
                      : run.status === 'failed' ? <AlertTriangle className="h-4 w-4" style={{ color: 'var(--rose)' }} />
                      : <RefreshCw className="h-4 w-4 animate-spin" style={{ color: 'var(--cyan)' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium" style={{ color: '#E8EDF5' }}>
                      {AGENT_LABELS[run.agent_type] || run.agent_type}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                      {run.products_checked} produtos · {run.alerts_created} alertas · {getTimeAgo(run.started_at)}
                    </p>
                  </div>
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background: run.status === 'completed' ? 'rgba(16,212,138,0.1)' : run.status === 'failed' ? 'rgba(244,63,94,0.1)' : 'rgba(6,200,217,0.1)',
                      color: run.status === 'completed' ? 'var(--emerald)' : run.status === 'failed' ? 'var(--rose)' : 'var(--cyan)',
                    }}
                  >
                    {run.status === 'completed' ? 'Concluído' : run.status === 'failed' ? 'Falhou' : 'Executando'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl"
        style={{ background: 'rgba(6,200,217,0.08)', border: '1px solid rgba(6,200,217,0.15)' }}
      >
        <Icon className="h-7 w-7" style={{ color: 'var(--cyan)' }} />
      </div>
      <p className="font-semibold mb-1" style={{ color: '#E8EDF5', fontFamily: 'var(--font-syne)' }}>{title}</p>
      <p className="text-[13px] max-w-sm" style={{ color: 'var(--muted-foreground)' }}>{desc}</p>
    </div>
  )
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  return `${Math.floor(hrs / 24)}d atrás`
}
