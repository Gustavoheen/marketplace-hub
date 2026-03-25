@AGENTS.md

# Marketplace Hub — Contexto do Projeto

## Visão Geral
Hub de gestão, auditoria e expansão de marketplaces para analistas de e-commerce.
Substitui o `bling-ml-app` (React+Vite+localStorage) com uma solução completa multi-tenant.

## Stack
- **Framework:** Next.js 16 (App Router) + TypeScript
- **UI:** Tailwind CSS 4 + shadcn/ui
- **Banco:** Supabase (PostgreSQL + Auth + RLS)
- **ORM:** Drizzle ORM
- **Charts:** Recharts
- **State:** TanStack Query
- **IA:** Claude API (Vercel AI SDK)
- **Deploy:** Vercel

## Breaking Changes Next.js 16
- `middleware.ts` → `proxy.ts` (mesmo comportamento, renomeado)
- `cookies()`, `headers()`, `params`, `searchParams` são TODOS async — sempre `await`
- Turbopack é padrão em dev e build

## Estrutura
- `src/app/(auth)/` — login, registro, callbacks OAuth
- `src/app/(app)/` — área autenticada com sidebar
- `src/app/auth/callback/` — callback Supabase Auth
- `src/app/compartilhado/[token]/` — portal público do cliente
- `src/lib/supabase/` — client.ts, server.ts, service.ts
- `src/lib/db/` — schema Drizzle + queries
- `src/lib/integrations/` — Bling, ML e outros marketplaces
- `src/lib/pricing/` — motor de precificação
- `src/lib/agents/` — Profit Watcher, Data Entry Bot
- `src/proxy.ts` — auth guard (Proxy Next.js 16)
- `supabase/migrations/` — SQL migrations

## Banco de Dados
Multi-tenant com RLS por `tenant_id`. Função `auth_tenant_id()` retorna o tenant do usuário autenticado.
Tabelas: `tenants`, `users`, `marketplace_connections`, `products`, `product_listings`, `orders`, `shared_dashboards`, `audit_logs`

## Env Vars Necessárias
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY` — AES-256 para criptografar tokens de marketplace
- `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`
- `ML_CLIENT_ID`, `ML_CLIENT_SECRET`
- `ANTHROPIC_API_KEY`
- `DATABASE_URL` — string de conexão PostgreSQL do Supabase (para Drizzle)

## Rodar o Projeto
```bash
cd C:/Users/Gustavo/marketplace-hub
npm run dev   # localhost:3000
```

## Fases de Implementação
- [x] Fase 1 — Fundação (auth, multi-tenant, layout)
- [ ] Fase 2 — Integrações (Bling + ML portados, outros marketplaces)
- [ ] Fase 3 — Dashboard BI (charts, KPIs, filtros)
- [ ] Fase 4 — Motor de Precificação
- [ ] Fase 5 — Portal do Cliente (links compartilhados)
- [ ] Fase 6 — Agentes Autônomos (Profit Watcher, Data Entry Bot)

## GitHub
- Conta: Gustavoheen
- Repo: https://github.com/Gustavoheen/marketplace-hub
