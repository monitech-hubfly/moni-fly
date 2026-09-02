# Arquivar e Mover Fase

> Domínio: 04-kanban

## Funcionalidade

Ações de ciclo de vida: mover coluna, arquivar com motivo, excluir, concluir.

## Componentes

`src/lib/actions/card-actions.ts`

## Banco

`motivo_arquivamento`, categorias — `388_motivo_arquivamento_categorias.sql`

## Gates

Validações antes de avançar fase: checklist obrigatório, aprovações bombeiro (`kanban_aprovacoes_fase`).


