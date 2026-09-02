# Funil Portfólio

> Domínio: 02-operacoes

## Funcionalidade

Esteira principal de negócios aprovados: paralelas informativas (Acoplamento, Crédito, Contabilidade, Jurídico, Capital).

## Objetivo

Orquestrar bastões para funis satélite e visão consolidada do franqueado.

## Onde funciona

`/portfolio` — `renderKanbanDatabasePage` + chips paralelas

**Kanban:** `Funil Portfólio` | UUID em `KANBAN_IDS.PORTFOLIO`

## Banco

Flags em `kanban_cards`: `acoplamento_concluido`, `credito_obra_ok`, `contabilidade_ok`, `juridico_ok`, `capital_ok`, `projetos_locais_ok`, `projetos_legais_ok`

**Migration:** `263_funil_portfolio_fases_nomes_sla.sql`, `195_portfolio_franqueados.sql`

## Componentes

`src/components/kanban-shared/KanbanParalelasChips.tsx`

## Próximas melhorias

- [ ] Documentar cada bastão spawn (origem → destino)


