import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { createDecipheriv } from 'crypto'

function decrypt(c) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  const [ivHex, tagHex, dataHex] = c.split(':')
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  d.setAuthTag(Buffer.from(tagHex, 'hex'))
  return d.update(Buffer.from(dataHex, 'hex')) + d.final('utf8')
}

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const BASE = 'https://www.bling.com.br/Api/v3'

async function blingDetail(token, id) {
  const r = await fetch(`${BASE}/pedidos/vendas/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (r.status === 429) { await sleep(2000); return blingDetail(token, id) }
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

function extractFromDetail(detail) {
  const d = detail?.data ?? detail ?? {}
  // UF: etiqueta do transporte é onde o Bling armazena o endereço de entrega
  const uf = d?.transporte?.etiqueta?.uf
    || d?.enderecoEntrega?.uf
    || d?.contato?.endereco?.uf
    || null
  const shipping_cost = Number(d?.transporte?.frete || d?.totaisMarketplace?.custoFrete || 0) || null
  const marketplace_fee = Number(d?.taxas?.find?.(t => t.tipo === 'marketplace')?.valor || d?.totaisMarketplace?.taxaMarketplace || 0) || null
  return {
    customer_state: uf ? String(uf).toUpperCase().trim() : null,
    shipping_cost,
    marketplace_fee,
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const { data: conn } = await svc.schema('marketplace').from('marketplace_connections')
    .select('tenant_id, access_token, expires_at')
    .eq('marketplace', 'bling').eq('status', 'active').limit(1).single()

  if (!conn) { console.error('Nenhuma conexão Bling ativa'); process.exit(1) }

  const tenantId = conn.tenant_id
  const token = decrypt(conn.access_token)
  const minutesLeft = (new Date(conn.expires_at) - Date.now()) / 60000
  console.log(`Tenant: ${tenantId} | Token válido por ${Math.round(minutesLeft)} min`)
  console.log('Estado via: transporte.etiqueta.uf | Frete via: transporte.frete\n')

  // Carrega TODOS os pedidos sem estado ou sem frete
  let allOrders = []
  let from = 0
  while (true) {
    const { data, error } = await svc.schema('marketplace').from('orders')
      .select('id, bling_id')
      .eq('tenant_id', tenantId)
      .or('customer_state.is.null,shipping_cost.is.null')
      .not('bling_id', 'is', null)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    allOrders = allOrders.concat(data)
    process.stdout.write(`\rCarregados ${allOrders.length}...`)
    if (data.length < 1000) break
    from += 1000
  }

  console.log(`\n\nTotal a processar: ${allOrders.length}\n`)

  let statesOk = 0, freteOk = 0, erros = 0, semDados = 0

  for (let i = 0; i < allOrders.length; i++) {
    const o = allOrders[i]
    try {
      const detail = await blingDetail(token, o.bling_id)
      const { customer_state, shipping_cost, marketplace_fee } = extractFromDetail(detail)

      const upd = {}
      if (customer_state) upd.customer_state = customer_state
      if (shipping_cost) upd.shipping_cost = shipping_cost
      if (marketplace_fee) upd.marketplace_fee = marketplace_fee

      if (Object.keys(upd).length > 0) {
        const { error } = await svc.schema('marketplace').from('orders').update(upd).eq('id', o.id)
        if (error) throw new Error(error.message)
        if (customer_state) statesOk++
        if (shipping_cost) freteOk++
      } else {
        semDados++
      }
    } catch (e) {
      erros++
      if (erros <= 5) console.log(`\n  Erro [${o.bling_id}]: ${e.message}`)
    }

    await sleep(340)

    if ((i + 1) % 25 === 0 || i === allOrders.length - 1) {
      const pct = (((i + 1) / allOrders.length) * 100).toFixed(1)
      process.stdout.write(`\r[${i + 1}/${allOrders.length}] ${pct}% | estados:${statesOk} frete:${freteOk} semDados:${semDados} erros:${erros}   `)
    }
  }

  console.log('\n\n✅ Concluído!')
  console.log(`  Estados preenchidos : ${statesOk}`)
  console.log(`  Fretes preenchidos  : ${freteOk}`)
  console.log(`  Sem dados no Bling  : ${semDados}`)
  console.log(`  Erros               : ${erros}`)
}

main().catch(e => { console.error(e); process.exit(1) })
