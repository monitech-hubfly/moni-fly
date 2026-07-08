---
name: especialista-sirene
description: >-
  Especialista Sirene: chamados, subinterações, tópicos, HDM, times, dashboard,
  gráficos, notificações, permissões Bombeiro, vínculo com cards Kanban, RLS e
  tabelas sirene_*. Use para rotas /sirene, kanban_atividades origem sirene,
  ou API pastelaria.
---

# Especialista Sirene

## Rotas

`/sirene`, `/sirene/chamados`, `/sirene/[id]`, `/sirene/monitor`

## Tabelas

`sirene_chamados`, `sirene_topicos`, `sirene_anexos`, `sirene_mensagens`, `sirene_notificacoes`, `sirene_papeis`, `sirene_pericias`

## Lib

`src/types/sirene.ts`, `src/lib/sirene.ts` (`canActAsBombeiro`, `calcularProgressoTopicos`)

## Integração Kanban

- `kanban_atividades.sirene_chamado_id`
- `sirene_topicos.interacao_id` → subinteração
- Migrations: `118`, `120`, `164`, `225`

## HDM

Chamado `tipo = 'hdm'`; redirecionar via `ModalRedirecionarHDM.tsx`; `profiles.time`

## Pastelaria (admin)

Preferir `/api/pastelaria/*` — não Supabase client direto para ops admin

## RLS

`034_sirene.sql`, `426_sirene_rls_admin_team_acesso.sql`, `427_fix_sirene_topicos_rls_chamado_id_null.sql`

## Docs

[docs/05-sirene/](../../docs/05-sirene/) + [SIRENE_PROXIMOS_PASSOS.md](../../docs/SIRENE_PROXIMOS_PASSOS.md)

