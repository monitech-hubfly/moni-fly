# Batalha e Modelos

> Domínio: 06-produto

## Funcionalidade

Batalha entre modelos de casa; funis Produto → Modelo Virtual → Homologações.

## Onde funciona

`/funil-produto`, `/funil-modelo-virtual`, `/funil-homologacoes`

`/pre-batalha` — ranking compatibilidade

**Migrations:** `005_batalhas_etapa8.sql`, `301_funil_stepone_batalha_vira_pre_batalha`, `303_funil_stepone_pre_batalha_ranking_compatibilidade.sql`

## Componentes

`src/lib/kanban/pre-batalha-compatibilidade.ts`


