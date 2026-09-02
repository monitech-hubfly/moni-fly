# Migrations SQL

> Domínio: 01-hub-fly

## Funcionalidade

Evolução do schema em `supabase/migrations/` (~400+ arquivos numerados + syncs `_SYNC_*`).

## Objetivo

Versionar alterações de banco de forma idempotente e rastreável.

## Onde funciona

`supabase/migrations/NNN_descricao.sql`

## Regras

1. Numerar sequencialmente (coordenar com equipe antes de criar)
2. `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
3. Idempotente — seguro reexecutar em DEV
4. Após aplicar: `NOTIFY pgrst, 'reload schema'`
5. **Nunca** aplicar em PROD sem confirmação explícita

## Migrations marco (referência)

| # | Tema |
|---|------|
| 002 | Schema idempotente base |
| 003 | Fix RLS profiles |
| 034–035 | Sirene inicial + HDM |
| 103–125 | Kanban atividades, histórico |
| 114 | Renomear kanbans e fases |
| 128 | Funil Acoplamento |
| 164–175 | Sirene ↔ kanban_atividades |
| 229 | Crédito Obra documentação SLA |
| 263 | Portfolio fases SLA |
| 419 | Kanban Funding |

## Padrão novo funil

Referência: `419_kanban_funding.sql` — inserir em `kanbans`, `kanban_fases`, checklists, RLS.

## Commits

<!-- TODO: política de branch + quem aplica em PROD -->

## Próximas melhorias

- [ ] Script de inventário automático de migrations por domínio


