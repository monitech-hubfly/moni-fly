-- 432: Justificativas de quebra de SLA por card+fase (todos os kanbans).

CREATE TABLE IF NOT EXISTS public.kanban_card_sla_justificativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_id UUID NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  justificativa TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT kanban_card_sla_justificativas_card_fase_unique UNIQUE (card_id, fase_id)
);

CREATE INDEX IF NOT EXISTS idx_kanban_card_sla_justificativas_card
  ON public.kanban_card_sla_justificativas (card_id);

CREATE INDEX IF NOT EXISTS idx_kanban_card_sla_justificativas_fase
  ON public.kanban_card_sla_justificativas (fase_id);

COMMENT ON TABLE public.kanban_card_sla_justificativas IS
  'Justificativa de quebra de SLA por fase deixada — persiste ao mudar de fase (todos os kanbans).';

ALTER TABLE public.kanban_card_sla_justificativas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_card_sla_justificativas_select" ON public.kanban_card_sla_justificativas;
CREATE POLICY "kanban_card_sla_justificativas_select"
  ON public.kanban_card_sla_justificativas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards c
      WHERE c.id = kanban_card_sla_justificativas.card_id
    )
  );

DROP POLICY IF EXISTS "kanban_card_sla_justificativas_insert" ON public.kanban_card_sla_justificativas;
CREATE POLICY "kanban_card_sla_justificativas_insert"
  ON public.kanban_card_sla_justificativas FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.kanban_cards c
      WHERE c.id = kanban_card_sla_justificativas.card_id
    )
  );

DROP POLICY IF EXISTS "kanban_card_sla_justificativas_update" ON public.kanban_card_sla_justificativas;
CREATE POLICY "kanban_card_sla_justificativas_update"
  ON public.kanban_card_sla_justificativas FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards c
      WHERE c.id = kanban_card_sla_justificativas.card_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kanban_cards c
      WHERE c.id = kanban_card_sla_justificativas.card_id
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.kanban_card_sla_justificativas TO authenticated;

-- Backfill a partir das colunas legadas em kanban_cards (fase atual no momento da migration).
INSERT INTO public.kanban_card_sla_justificativas (card_id, fase_id, justificativa, created_at, updated_at, created_by)
SELECT
  c.id,
  c.fase_id,
  TRIM(c.sla_justificativa),
  COALESCE(c.sla_justificativa_em, NOW()),
  COALESCE(c.sla_justificativa_em, NOW()),
  c.sla_justificativa_por
FROM public.kanban_cards c
WHERE c.fase_id IS NOT NULL
  AND c.sla_justificativa IS NOT NULL
  AND TRIM(c.sla_justificativa) <> ''
ON CONFLICT (card_id, fase_id) DO NOTHING;

-- entered_fase_at continua resetando na mudança de fase; justificativas ficam na tabela dedicada.
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

NOTIFY pgrst, 'reload schema';
