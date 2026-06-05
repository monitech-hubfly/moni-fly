# Performance em produção (Hub Fly)

Otimizações **infra/dashboard** que complementam as mudanças de código (índices SQL, paralelização do snapshot). Não alteram UX nem arquitetura.

## Supabase

### Aplicar migration 245

Rodar `245_perf_kanban_hot_indexes.sql` no projeto de produção (SQL Editor ou pipeline de migrations).

### Connection pooler (Postgres direto)

O cliente `@supabase/supabase-js` usa a **REST API** (`https://<ref>.supabase.co`). **Não** troque `NEXT_PUBLIC_SUPABASE_URL` pelo host do pooler.

Para scripts que abrem conexão Postgres (`pg`, `PROD_DB_URL`, `SUPABASE_DB_URL`):

- **Transaction pooler (recomendado serverless):** porta `6543`, host `aws-0-…pooler.supabase.com`
- **Session mode:** porta `5432` no pooler — use só se a ferramenta exigir prepared statements longos

Exemplo (já documentado em `.env.local.example`):

```env
PROD_DB_URL=postgresql://postgres.[ref]:[password]@aws-0-…pooler.supabase.com:6543/postgres
```

### Dashboard Supabase

- **Database → Reports:** verificar queries lentas após deploy dos índices
- **Settings → API:** confirmar região próxima à Vercel (ex.: `sa-east-1` se possível)
- **Auth → Rate limits:** não impacta kanban, mas evita throttling em picos de login

## Vercel

### Região e plano

- Projeto na **mesma região** do Supabase reduz latência RTT por request RSC
- **Fluid Compute / Pro:** menos cold starts em funções serverless com `force-dynamic`

### Variáveis de ambiente

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` corretos em Production
- `SUPABASE_SERVICE_ROLE_KEY` só onde necessário (rotas públicas); não expor no client

### Observabilidade

- **Vercel → Speed Insights / Web Analytics:** TTFB das rotas kanban (`/painel-novos-negocios`, funis)
- **Logs:** filtrar duração de Server Components após deploy

### Cache (limitado com `force-dynamic`)

Com `export const dynamic = 'force-dynamic'` no layout, páginas kanban **não** usam ISR estático. Ganhos de cache vêm de:

- Assets estáticos (`/_next/static`) — CDN automática
- `compress: true` no `next.config.js` (gzip/brotli na Vercel)

Não desabilitar `force-dynamic` sem revisão de auth — o shell depende de cookies de sessão.

## Não implementado (requer mudança estrutural)

| Item | Motivo |
|------|--------|
| Eliminar 2ª/3ª fetch de `profiles` (middleware + layout + snapshot) | Campos e momentos de redirect diferentes; deduplicar exigiria cache de request ou prop drilling |
| Paginar snapshot / lazy modal / remover `router.refresh` | Fora do escopo acordado |
| Trocar `force-dynamic` | Risco de shell com papel errado |

## Checklist pós-deploy

1. Migration 245 aplicada em prod
2. Deploy Vercel com `next.config.js` atualizado
3. Smoke test: abrir painel kanban + modal de card (mesmo comportamento)
4. Comparar TTFB antes/depois nas rotas principais
