-- 486: Ancora fase/etapa da data de reunião para prompt ao mudar de fase.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS data_reuniao_fase_id uuid REFERENCES public.kanban_fases(id) ON DELETE SET NULL;

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS data_reuniao_etapa_slug text;

COMMENT ON COLUMN public.kanban_cards.data_reuniao_fase_id IS
  'Fase em que data_reuniao foi definida; divergência da fase atual dispara prompt de reinício.';

COMMENT ON COLUMN public.processo_step_one.data_reuniao_etapa_slug IS
  'etapa_painel em que data_reuniao foi definida (legado).';

UPDATE public.kanban_cards c
SET data_reuniao_fase_id = c.fase_id
WHERE c.data_reuniao IS NOT NULL
  AND c.data_reuniao_fase_id IS NULL;

UPDATE public.processo_step_one p
SET data_reuniao_etapa_slug = p.etapa_painel
WHERE p.data_reuniao IS NOT NULL
  AND (p.data_reuniao_etapa_slug IS NULL OR TRIM(p.data_reuniao_etapa_slug) = '');

NOTIFY pgrst, 'reload schema';
