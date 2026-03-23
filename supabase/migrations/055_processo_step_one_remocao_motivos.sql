-- Remoção e cancelamento com motivo (Kanban)
-- "Remover": usado quando o card foi criado errado (não deve aparecer no board, mas mantém histórico).
-- "Cancelar": usado quando o franqueado desistiu.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS cancelado_motivo TEXT,
  ADD COLUMN IF NOT EXISTS removido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removido_motivo TEXT;

COMMENT ON COLUMN public.processo_step_one.cancelado_motivo IS 'Motivo do cancelamento do processo (Kanban).';
COMMENT ON COLUMN public.processo_step_one.removido_em IS 'Preenchido quando o card é removido (criado errado).';
COMMENT ON COLUMN public.processo_step_one.removido_motivo IS 'Motivo da remoção do card (criado errado).';

-- Permitir status 'removido' no check constraint existente
ALTER TABLE public.processo_step_one
  DROP CONSTRAINT IF EXISTS processo_step_one_status_check;

ALTER TABLE public.processo_step_one
  ADD CONSTRAINT processo_step_one_status_check
  CHECK (status IN ('rascunho', 'em_andamento', 'concluido', 'cancelado', 'removido'));

