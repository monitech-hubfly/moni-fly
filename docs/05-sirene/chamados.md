# Chamados Sirene

> Domínio: 05-sirene

## Funcionalidade

Central de chamados com tipos Padrão e HDM, vínculo opcional a card Kanban.

## Onde funciona

`/sirene`, `/sirene/chamados`, `/sirene/[id]`

## Banco

`sirene_chamados` — campos: `tipo`, `hdm_responsavel`, `card_id`, `data_vencimento`

**Migrations:** `034_sirene.sql`, `035_sirene_hdm.sql`, `324_sirene_chamados_hdm_executivo_local.sql`

## Lib / types

`src/types/sirene.ts`, `src/lib/sirene.ts`, actions em `src/lib/actions/` (criarChamado, fecharChamado, …)

## UI

`src/app/sirene/ModalNovoChamado.tsx`, `ClassificacaoConclusaoModal.tsx`


