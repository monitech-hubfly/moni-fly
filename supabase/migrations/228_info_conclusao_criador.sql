-- Informação obrigatória do criador ao concluir o chamado (regra CARD)
ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS info_conclusao_criador TEXT;

COMMENT ON COLUMN public.sirene_chamados.info_conclusao_criador IS
  'Texto informado pelo criador ao marcar o chamado como concluído (suficiente).';

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS info_conclusao_criador TEXT;

COMMENT ON COLUMN public.kanban_atividades.info_conclusao_criador IS
  'Texto do criador ao concluir a interação/chamado no funil (sem sirene_chamados vinculado).';
