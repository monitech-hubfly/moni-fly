-- Pré-requisito para reset de SLA e para o board pós-deploy (migrations 213 + 229).
-- Rode UMA VEZ no SQL Editor do ambiente correto (DEV ou PROD) antes de reset_sla_todos_cards.sql.
-- Idempotente (IF NOT EXISTS).

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS entered_fase_at timestamptz;

COMMENT ON COLUMN public.kanban_cards.entered_fase_at IS
  'Momento em que o card entrou na fase atual (SLA).';

UPDATE public.kanban_cards
SET entered_fase_at = COALESCE(entered_fase_at, created_at)
WHERE entered_fase_at IS NULL;

CREATE OR REPLACE FUNCTION public.fn_kanban_cards_entered_fase_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.entered_fase_at := COALESCE(NEW.entered_fase_at, NOW());
  ELSIF TG_OP = 'UPDATE' AND NEW.fase_id IS DISTINCT FROM OLD.fase_id THEN
    NEW.entered_fase_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_cards_entered_fase_at ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_entered_fase_at
  BEFORE INSERT OR UPDATE OF fase_id ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_kanban_cards_entered_fase_at();

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS alvara_url TEXT,
  ADD COLUMN IF NOT EXISTS docs_terreno_url TEXT,
  ADD COLUMN IF NOT EXISTS sla_iniciado_em TIMESTAMPTZ;

COMMENT ON COLUMN public.kanban_cards.sla_iniciado_em IS
  'Quando preenchido, o SLA da fase usa esta data em vez de created_at.';

NOTIFY pgrst, 'reload schema';
