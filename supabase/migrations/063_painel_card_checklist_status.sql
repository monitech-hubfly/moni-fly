-- Checklist do Painel Novos Negócios: status (não iniciada / em andamento / concluída)

ALTER TABLE public.processo_card_checklist
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'nao_iniciada';

-- garantir domínio de valores (mantém compatibilidade com Postgres existentes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'processo_card_checklist_status_check'
  ) THEN
    ALTER TABLE public.processo_card_checklist
      ADD CONSTRAINT processo_card_checklist_status_check
      CHECK (status IN ('nao_iniciada', 'em_andamento', 'concluido'));
  END IF;
END $$;

-- Backfill: derive do campo antigo "concluido"
UPDATE public.processo_card_checklist
SET status = CASE
  WHEN concluido IS TRUE THEN 'concluido'
  ELSE 'nao_iniciada'
END
WHERE status IS NULL OR status = 'nao_iniciada';

