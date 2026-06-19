-- 391: coluna assunto em kanban_card_atas_reuniao (PROD pode ter tabela sem ela)

ALTER TABLE public.kanban_card_atas_reuniao
  ADD COLUMN IF NOT EXISTS assunto text;

UPDATE public.kanban_card_atas_reuniao
SET assunto = COALESCE(
  NULLIF(TRIM(assunto), ''),
  NULLIF(TRIM(conteudo->>'assunto'), ''),
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
