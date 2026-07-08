# Arquitetura Hub Fly

> Domínio: 01-hub-fly

## Funcionalidade

Plataforma **Next.js 14** (App Router) + **TypeScript** + **Tailwind** + **Supabase** (Auth, PostgreSQL, Storage, RLS) para gestão de franquias Casa Moní: funis Kanban, Step One, Sirene, Carômetro, portal do franqueado.

## Objetivo

Centralizar operações de novos negócios, crédito, jurídico, produto e atendimento em um único hub com permissões por papel.

## Onde funciona

| Contexto | Caminho |
|----------|---------|
| App principal | `src/app/` |
| Server actions / lib | `src/lib/` |
| Componentes UI | `src/components/` |
| Migrations | `supabase/migrations/` |
| Regras Cursor | `.cursor/rules/`, `.cursorrules` |

## Estrutura de pastas (resumo)

```
src/app/           # Rotas por módulo (funil-*, sirene, portfolio, …)
src/components/    # UI compartilhada + kanban-shared/
src/lib/           # actions, kanban/, authz, access-matrix
src/hooks/         # useAuditLog, usePermissoes, …
src/styles/        # moni-tokens.css
supabase/migrations/
docs/              # Este manual
```

## Banco

- **DEV:** `bgaadvfucnrkpimaszjv.supabase.co`
- **PROD:** `aydryzoxqnwnbybvgiug.supabase.co` — alterações somente com confirmação explícita

Tabelas centrais: `profiles`, `kanban_*`, `processo_step_one`, `rede_franqueados`, `sirene_*`, `audit_log`.

## Componentes

| Arquivo | Papel |
|---------|-------|
| `src/lib/authz.ts` | Normalização de papéis |
| `src/lib/access-matrix.ts` | Prefixos de rota por papel |
| `src/lib/supabase/middleware.ts` | Guard de rotas |
| `src/components/PortalSidebar.tsx` | Navegação principal |

## Migrations

Ver [migrations.md](migrations.md). Schema base: `002_idempotent_schema.sql`, correções RLS: `003_fix_rls_recursion_profiles.sql`.

## Commits

<!-- TODO: preencher marcos de arquitetura (kanban nativo, sirene unificado, carômetro) -->

## Próximas melhorias

- [ ] Diagrama C4 atualizado
- [ ] Inventário de API routes (`/api/*`)

## Referências

- [README raiz](../../README.md)
- [inventario-kanban-funil-completo.md](../inventario-kanban-funil-completo.md) (legado detalhado)


