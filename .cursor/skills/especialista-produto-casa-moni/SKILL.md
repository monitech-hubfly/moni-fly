---
name: especialista-produto-casa-moni
description: >-
  Especialista Produto Casa Moní: Kit Moní, Moní INC, Configurador, BCA, Batalha,
  Modelos Virtuais, Homologações, Universidade, Treinamentos e Catálogo de casas.
  Use para funis produto, pré-batalha, pdf_exports, universidade ou catálogo.
---

# Especialista Produto Casa Moní

## Funis produto

| Rota | Kanban |
|------|--------|
| `/funil-produto` | Funil Produto |
| `/funil-modelo-virtual` | Modelo Virtual |
| `/funil-homologacoes` | Homologações |
| `/pre-batalha` | Ranking pré-batalha |
| `/treinamento-bca` | Treinamento BCA |
| `/universidade` | Universidade |
| `/catalogo-produtos-moni` | Catálogo (admin) |

## Banco / migrations

- `005_batalhas_etapa8.sql`
- `160_checklist_fases_moni_inc.sql`
- `301_funil_stepone_batalha_vira_pre_batalha.sql`
- `pdf_exports` — histórico PDF BCA

## Componentes

`src/lib/kanban/pre-batalha-compatibilidade.ts`
`src/lib/universidade/actions.ts`
`src/app/step-one/[id]/etapa/*` — etapas catálogo/BCA

## Especificação Step One

[docs/STEP_ONE_ESPEC.md](../../docs/STEP_ONE_ESPEC.md) — etapas 4–11 catálogo e BCA

## Docs

[docs/06-produto/](../../docs/06-produto/) + [CATALOGO_CASAS_TABELA.md](../../docs/CATALOGO_CASAS_TABELA.md)

