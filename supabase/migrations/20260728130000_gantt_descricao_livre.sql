-- Migration: gantt_planejamento — acao_id nullable + coluna descricao_livre
-- Permite itens inline do Boné Day sem criar tarefa/acao no catálogo
-- Impacto: aditivo. acao_id null já é filtrado no Backlog (.not('acao_id','is',null))
-- e no Workload (.in('acao_id', acaoIdsLista)). Sem quebra em outros fluxos.

ALTER TABLE gantt_planejamento ALTER COLUMN acao_id DROP NOT NULL;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS descricao_livre text;

NOTIFY pgrst, 'reload schema';
