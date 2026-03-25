// ─── Groq API client (gratuito) ──────────────────────────────────────────────
// Modelo: llama-3.3-70b-versatile
// Free tier: 14.400 req/dia, 6.000 tokens/min
// Docs: https://console.groq.com/docs

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

export type GroqMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type GroqOptions = {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: false
}

export async function groqChat(
  messages: GroqMessage[],
  opts: GroqOptions = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY não configurada')

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 2048,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any
    throw new Error(err?.error?.message || `Groq API error ${res.status}`)
  }

  const data = await res.json() as any
  return data.choices[0]?.message?.content ?? ''
}

// ─── Prompt de sistema do agente Marketplace Hub ──────────────────────────────

export const AGENT_SYSTEM_PROMPT = `Você é um Agente Gestor de E-commerce especializado, integrado ao Marketplace Hub.

Você tem acesso a dados reais do sistema:
- Produtos sincronizados do ERP (Bling)
- Conexões com marketplaces ativas
- Histórico de pedidos e receita
- Status de buybox e catálogo por produto
- Alertas de margem gerados pelo Profit Watcher

Suas responsabilidades:
1. **Análise de Margem**: Identificar produtos com margem negativa ou abaixo do mínimo definido
2. **Buybox**: Alertar quando produtos estão perdendo o buybox e sugerir ajuste de preço
3. **Catálogo**: Monitorar posição nos catálogos dos marketplaces
4. **Relatório Executivo**: Gerar resumos claros com métricas, tendências e ações prioritárias
5. **Recomendações de Preço**: Sugerir quando aumentar ou diminuir preços com base em dados

Formato de resposta:
- Seja direto e objetivo
- Use emojis para indicar status (🟢 bom, 🟡 atenção, 🔴 urgente)
- Priorize ações por impacto financeiro
- Apresente números em R$ e percentuais
- Responda sempre em português brasileiro`

// ─── Funções especializadas de análise ───────────────────────────────────────

export async function gerarRelatorioExecutivo(dados: {
  totalProdutos: number
  totalPedidos: number
  receita: number
  margemMedia: number
  alertas: Array<{ tipo: string; produto: string; detalhe: string }>
  buyboxAlerts: Array<{ produto: string; marketplace: string; status: string }>
  periodo: string
}): Promise<string> {
  const messages: GroqMessage[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Gere um relatório executivo resumido com base nos seguintes dados do período ${dados.periodo}:

MÉTRICAS:
- Total de produtos: ${dados.totalProdutos}
- Pedidos no período: ${dados.totalPedidos}
- Receita total: R$ ${dados.receita.toFixed(2)}
- Margem média: ${dados.margemMedia.toFixed(1)}%

ALERTAS DE MARGEM (${dados.alertas.length} alertas):
${dados.alertas.slice(0, 10).map((a) => `- [${a.tipo}] ${a.produto}: ${a.detalhe}`).join('\n') || 'Nenhum alerta'}

BUYBOX / CATÁLOGO (${dados.buyboxAlerts.length} alertas):
${dados.buyboxAlerts.slice(0, 10).map((b) => `- ${b.produto} no ${b.marketplace}: ${b.status}`).join('\n') || 'Nenhum alerta'}

Gere um relatório executivo com:
1. Resumo geral (3-4 linhas)
2. Ações prioritárias (máx. 5 itens, ordenadas por impacto)
3. Oportunidades identificadas
4. Riscos que precisam de atenção`,
    },
  ]

  return groqChat(messages, { temperature: 0.4, maxTokens: 1500 })
}

export async function analisarPrecoProduto(dados: {
  produto: string
  precoAtual: number
  custo: number
  margemAtual: number
  precoCompetidores?: number[]
  perdendoBuybox: boolean
  marketplace: string
  comissao: number
}): Promise<string> {
  const messages: GroqMessage[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Analise a precificação do seguinte produto e recomende ação:

Produto: ${dados.produto}
Marketplace: ${dados.marketplace}
Preço atual: R$ ${dados.precoAtual.toFixed(2)}
Custo: R$ ${dados.custo.toFixed(2)}
Margem atual: ${dados.margemAtual.toFixed(1)}%
Comissão do marketplace: ${dados.comissao}%
${dados.perdendoBuybox ? '⚠️ PERDENDO BUYBOX' : '✅ Ganhando buybox'}
${dados.precoCompetidores?.length ? `Preços dos competidores: ${dados.precoCompetidores.map((p) => `R$ ${p.toFixed(2)}`).join(', ')}` : ''}

Responda em 3-5 linhas com recomendação clara de ação (manter, reduzir X%, aumentar X%).`,
    },
  ]

  return groqChat(messages, { temperature: 0.3, maxTokens: 400 })
}
