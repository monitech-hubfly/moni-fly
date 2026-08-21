-- Migration 213: flags Projetos Locais/Legais, origem do card, entrada na fase (SLA)

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS projetos_locais_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS projetos_legais_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem_tipo text,
  ADD COLUMN IF NOT EXISTS entered_fase_at timestamptz;

COMMENT ON COLUMN public.kanban_cards.projetos_locais_ok IS 'Bastão de retorno: funil Projetos Locais concluído.';
COMMENT ON COLUMN public.kanban_cards.projetos_legais_ok IS 'Bastão de retorno: funil Projetos Legais concluído.';
COMMENT ON COLUMN public.kanban_cards.origem_tipo IS 'Origem informativa do card (ex.: hipotese_direta).';
COMMENT ON COLUMN public.kanban_cards.entered_fase_at IS 'Momento em que o card entrou na fase atual (SLA).';

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
