# Paridade DEV ↔ PROD

O DEV deve refletir as migrations do repositório. Se algo funciona em PROD e não no DEV, o schema ou seeds provavelmente não foram aplicados no projeto Supabase DEV.

## Atalho (SQL Editor)

Um único ficheiro com os fixes críticos já vistos em DEV:

**[`sync-dev-paridade-prod-essencial.sql`](sync-dev-paridade-prod-essencial.sql)** — cole e execute no Supabase SQL Editor (projeto DEV).

## Comandos (máquina com acesso ao Postgres DEV)

```bash
# Diagnóstico (colunas, checklist mapa, RLS)
npm run db:check-dev

# Aplica migrations 269→370 + scripts de paridade
npm run db:sync-dev
```

Requer `DEV_DB_URL` em `.env.local` e `psql` no PATH.

## Se `db:sync-dev` falhar (timeout de rede)

No **Supabase SQL Editor** do projeto DEV, execute **nesta ordem**:

1. [`fix-dev-funil-stepone.sql`](fix-dev-funil-stepone.sql) — RLS/grants kanban_cards, `processo_step_one_id`, `hora_reuniao`
2. [`fix-dev-checklist-mapa-competidores.sql`](fix-dev-checklist-mapa-competidores.sql) — meta checklist + widget Mapa de Competidores
3. [`fix-dev-listings-casas.sql`](fix-dev-listings-casas.sql) — GRANT/RLS `listings_casas` (erro no checklist Mapa)
4. Migrations individuais em `supabase/migrations/` a partir de **269** (ou use o Dashboard → Database → Migrations se `supabase link` estiver configurado)

## O que o código já tolera (schema antigo)

- SELECT de checklist sem `campo_slug` / `config_json` (`fase-checklist-select.ts`)
- SELECT de cards sem `hora_reuniao` (`kanban-card-select-cols.ts`)
- Cards com `concluido`/`arquivado` NULL no board

Mesmo assim, **seeds de checklist e RLS** só existem no banco após rodar as migrations/SQL acima.

## Manter DEV atualizado

Sempre que mergear migrations novas em `main`:

```bash
npm run db:sync-dev
# ou, a partir de uma migration específica:
node --env-file=.env.local scripts/sync-dev-paridade-prod.mjs --from=366
```
