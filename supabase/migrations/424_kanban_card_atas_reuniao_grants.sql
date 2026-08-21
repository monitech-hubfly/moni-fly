-- 424: alinha kanban_card_atas_reuniao (grants + colunas card_origem/preenchido_por em schemas legados)

GRANT SELECT, INSERT ON public.kanban_card_atas_reuniao TO authenticated, service_role;

ALTER TABLE public.kanban_card_atas_reuniao
  ADD COLUMN IF NOT EXISTS card_origem text;

ALTER TABLE public.kanban_card_atas_reuniao
  ADD COLUMN IF NOT EXISTS preenchido_por uuid REFERENCES auth.users (id) ON DELETE SET NULL;

UPDATE public.kanban_card_atas_reuniao
SET card_origem = 'nativo'
WHERE card_origem IS NULL OR TRIM(card_origem) = '';

UPDATE public.kanban_card_atas_reuniao
SET preenchido_por = autor_id
WHERE preenchido_por IS NULL AND autor_id IS NOT NULL;

ALTER TABLE public.kanban_card_atas_reuniao
  ALTER COLUMN card_origem SET DEFAULT 'nativo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_card_atas_reuniao WHERE card_origem IS NULL
  ) THEN
    ALTER TABLE public.kanban_card_atas_reuniao
      ALTER COLUMN card_origem SET NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.kanban_card_atas_reuniao
    ADD CONSTRAINT kanban_card_atas_reuniao_card_origem_check
    CHECK (card_origem IN ('nativo', 'legado'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.kanban_card_atas_reuniao
  ADD COLUMN IF NOT EXISTS assunto text;

UPDATE public.kanban_card_atas_reuniao
SET assunto = COALESCE(
  NULLIF(TRIM(assunto), ''),
  NULLIF(TRIM((COALESCE(conteudo::jsonb, '{}'::jsonb))->>'assunto'), ''),
  'Reunião'
)
WHERE assunto IS NULL OR TRIM(assunto) = '';

ALTER TABLE public.kanban_card_atas_reuniao
  ALTER COLUMN assunto SET DEFAULT 'Reunião';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_card_atas_reuniao WHERE assunto IS NULL
  ) THEN
    ALTER TABLE public.kanban_card_atas_reuniao
      ALTER COLUMN assunto SET NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE public.kanban_card_atas_reuniao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kanban_card_atas_reuniao_select ON public.kanban_card_atas_reuniao;
CREATE POLICY kanban_card_atas_reuniao_select
  ON public.kanban_card_atas_reuniao FOR SELECT TO authenticated
  USING (
    (card_origem = 'nativo' AND EXISTS (
      SELECT 1 FROM public.kanban_cards c WHERE c.id = kanban_card_atas_reuniao.card_id
    ))
    OR (card_origem = 'legado' AND EXISTS (
      SELECT 1 FROM public.processo_step_one p WHERE p.id = kanban_card_atas_reuniao.card_id
    ))
  );

DROP POLICY IF EXISTS kanban_card_atas_reuniao_insert ON public.kanban_card_atas_reuniao;
CREATE POLICY kanban_card_atas_reuniao_insert
  ON public.kanban_card_atas_reuniao FOR INSERT TO authenticated
  WITH CHECK (
    (preenchido_por IS NULL OR preenchido_por = auth.uid())
    AND (
      (card_origem = 'nativo' AND EXISTS (
        SELECT 1 FROM public.kanban_cards c WHERE c.id = kanban_card_atas_reuniao.card_id
      ))
      OR (card_origem = 'legado' AND EXISTS (
        SELECT 1 FROM public.processo_step_one p WHERE p.id = kanban_card_atas_reuniao.card_id
      ))
    )
  );

COMMENT ON COLUMN public.kanban_card_atas_reuniao.card_origem IS
  'nativo = kanban_cards; legado = processo_step_one.';

COMMENT ON COLUMN public.kanban_card_atas_reuniao.preenchido_por IS
  'Usuário autenticado que registrou a ata (substitui autor_id legado).';
