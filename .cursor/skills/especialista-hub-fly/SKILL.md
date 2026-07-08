---
name: especialista-hub-fly
description: >-
  Especialista na plataforma Hub Fly: arquitetura Next.js/Supabase, design system
  moni-tokens, permissões profiles.role, migrations, deploy, componentes
  compartilhados e padrões do projeto. Use para questões transversais de
  infraestrutura, auth, banco DEV/PROD, Cursor rules ou quando não souber qual
  domínio de negócio aplicar.
---

# Especialista Hub Fly

## Quando usar

- Arquitetura, setup, env, deploy, git/PR
- `profiles.role`, middleware, `access-matrix.ts`
- Migrations SQL, RLS, scripts `pg`
- Design system: **sempre** `src/styles/moni-tokens.css` — sem hex, sem laranja
- Componentes em `src/components/kanban-shared/` usados por vários funis

## Regras críticas

| Regra | Detalhe |
|-------|---------|
| DEV | `bgaadvfucnrkpimaszjv.supabase.co` |
| PROD | `aydryzoxqnwnbybvgiug.supabase.co` — não alterar sem confirmação |
| Responsável | `profiles.id` uuid — nunca texto livre |
| Bordas | 0.5px via `--moni-border-width` |
| Migrations | Idempotentes; `NOTIFY pgrst, 'reload schema'` após aplicar |

## Arquivos-chave

```
src/lib/authz.ts
src/lib/access-matrix.ts
src/lib/supabase/middleware.ts
src/styles/moni-tokens.css
.cursorrules
```

## Documentação

- [docs/01-hub-fly/](../../docs/01-hub-fly/)
- [docs/onboarding/](../../docs/onboarding/)
- Permissões: [docs/MATRIZ_ACESSO_USUARIOS.md](../../docs/MATRIZ_ACESSO_USUARIOS.md)

## Workflow migration

1. Criar `supabase/migrations/NNN_descricao.sql` com `IF NOT EXISTS`
2. Aplicar só em DEV
3. Testar RLS com papéis admin/team/frank
4. PR para revisão antes de PROD

