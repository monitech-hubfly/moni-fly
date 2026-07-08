# Funil Step One

> Domínio: 02-operacoes

## Funcionalidade

Kanban de onboarding e viabilidade do franqueado: condomínios, mapa, pré-batalha, BCA, integração com rede.

## Objetivo

Conduzir o candidato/franqueado do primeiro contato até decisão de batalha e entrada no portfólio.

## Onde funciona

| Contexto | Rota |
|----------|------|
| Kanban | `/funil-stepone` |
| Processo legado 11 etapas | `/step-one/[id]` |
| Painel legado | `/painel-novos-negocios` |

**UUID kanban:** ver `KANBAN_IDS.STEP_ONE` em `src/lib/constants/kanban-ids.ts`

## Banco

| Tabela | Uso |
|--------|-----|
| `kanban_cards` | Cards nativos |
| `processo_step_one` | Legado / sync |
| `condominios` | Dados de condomínio |
| `rede_franqueados` | Auto-cura cards da rede |

**Migrations:** `248_funil_stepone_*`, `301_funil_stepone_batalha_vira_pre_batalha`, `385_stepone_responsavel_fase_franqueado_rede`

## Componentes

| Arquivo | Papel |
|---------|-------|
| `src/app/funil-stepone/` | Board custom |
| `src/app/step-one/[id]/etapa/*` | Etapas 1–11 |
| `src/lib/kanban/pre-batalha-compatibilidade.ts` | Ranking pré-batalha |

## Especificação legada

[STEP_ONE_ESPEC.md](../STEP_ONE_ESPEC.md) — Etapas 1–11, checklist 16 itens, BCA, Apify/ZAP.

## Próximas melhorias

<!-- TODO: preencher com compilado de garantias / sessões PDF Step One -->
- [ ] Unificar documentação etapas vs kanban nativo


