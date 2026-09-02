# Permissões e Acesso

> Domínio: 01-hub-fly

## Funcionalidade

Controle de acesso por `profiles.role`, middleware Next.js e matriz de prefixos de rota.

## Objetivo

Isolar dados do franqueado (Frank), liberar funis ao time Moní e restringir rotas administrativas.

## Onde funciona

| Arquivo | Função |
|---------|--------|
| `src/lib/authz.ts` | `normalizeAccessRole`, `isAdmin` |
| `src/lib/access-matrix.ts` | `TEAM_ALLOWED_*`, `FRANK_*`, `ADMIN_ONLY_*` |
| `src/lib/supabase/middleware.ts` | Redirect por papel |
| `src/lib/hooks/usePermissoes.ts` | Hook client-side |

## Papéis (`profiles.role`)

| Valor DB | Normalizado | Resumo |
|----------|-------------|--------|
| `admin` | admin | Acesso amplo |
| `team` | team | Prefixos em `TEAM_ALLOWED_PATH_PREFIXES` |
| `frank`, `franqueado` | frank | Hub limitado + `/portal-frank` |
| `pending` / `blocked` | — | Preso no login |
| `consultor`, `supervisor` | admin | Legado → admin |

## Banco

| Tabela | Uso |
|--------|-----|
| `profiles` | `role`, `time`, dados do usuário |
| `team_members` | Membros de times (Sirene/Kanban) |

**Regra:** responsável em card/checklist → sempre `profiles.id` (uuid), nunca texto livre.

**Migrations:** `003_fix_rls_recursion_profiles.sql`, `083_team_members.sql`, `368_kanban_cards_select_staff.sql`

## Prefixos (resumo)

- **Team:** `/rede-franqueados`, `/portfolio`, `/funil-stepone`, `/sirene`, `/operacoes`, …
- **Frank:** portal + funis de novos negócios (RLS limita cards)
- **Admin only:** catálogo, crédito interno legado, `/admin/*`, etc.

Detalhe completo: [MATRIZ_ACESSO_USUARIOS.md](../MATRIZ_ACESSO_USUARIOS.md)

## Próximas melhorias

- [ ] Matriz por feature (não só por rota)


