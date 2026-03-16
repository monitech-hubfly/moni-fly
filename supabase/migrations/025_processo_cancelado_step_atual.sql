-- Cancelamento de processo (a partir do Step 2) e step_atual para Kanban
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS step_atual INT NOT NULL DEFAULT 1 CHECK (step_atual >= 1 AND step_atual <= 5);

ALTER TABLE public.processo_step_one
  DROP CONSTRAINT IF EXISTS processo_step_one_status_check;

ALTER TABLE public.processo_step_one
  ADD CONSTRAINT processo_step_one_status_check
  CHECK (status IN ('rascunho', 'em_andamento', 'concluido', 'cancelado'));

COMMENT ON COLUMN public.processo_step_one.cancelado_em IS 'Preenchido quando o franqueado cancela o processo (a partir do Step 2)';
COMMENT ON COLUMN public.processo_step_one.step_atual IS '1=Step 1 Região, 2=Step 2 Novo negócio, 3=Opções, 4=Check Legal, 5=Comitê; usado no Kanban';
