-- 391: coluna assunto em kanban_card_atas_reuniao (PROD pode ter tabela sem ela ou conteudo em text)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kanban_card_atas_reuniao'
      AND column_name = 'conteudo'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.kanban_card_atas_reuniao
      ALTER COLUMN conteudo TYPE jsonb USING (
        CASE
          WHEN conteudo IS NULL OR TRIM(conteudo) = '' THEN '{}'::jsonb
          ELSE conteudo::jsonb
        END
      );
  END IF;
END $$;

ALTER TABLE public.kanban_card_atas_reuniao
  ADD COLUMN IF NOT EXISTS assunto text;

UPDATE public.kanban_card_atas_reuniao
SET assunto = COALESCE(
  NULLIF(TRIM(assunto), ''),
  NULLIF(
    TRIM(
      (COALESCE(conteudo::jsonb, '{}'::jsonb))->>'assunto'
    ),
    ''
  ),
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
END $$;

COMMENT ON COLUMN public.kanban_card_atas_reuniao.assunto IS
  'Assunto principal da reunião; espelhado em conteudo.assunto para consultas.';
