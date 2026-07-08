# Dashboard e Notificações

> Domínio: 05-sirene

## Funcionalidade

KPIs, gráficos por status, sino com últimas notificações.

## Banco

`sirene_notificacoes` — tipos: `novo_chamado`, `chamado_hdm_recebido`, `topico_aprovado`, …

**Migration:** `042_sirene_notificacoes_topico_id.sql`

## Pastelaria

API `/api/pastelaria/*` — `src/lib/pastelaria/sirene-status-sync.ts`


