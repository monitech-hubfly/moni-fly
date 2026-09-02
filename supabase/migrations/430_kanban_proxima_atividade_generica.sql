-- 430: Próxima atividade genérica em kanban_cards (todos os funis).
-- Migra dados de funding_proxima_atividade / funding_prazo_atividade se existirem.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS proxima_atividade text,
  ADD COLUMN IF NOT EXISTS prazo_atividade date;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kanban_cards'
      AND column_name = 'funding_proxima_atividade'
  ) THEN
    UPDATE public.kanban_cards
    SET proxima_atividade = COALESCE(proxima_atividade, funding_proxima_atividade)
    WHERE funding_proxima_atividade IS NOT NULL
      AND proxima_atividade IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kanban_cards'
      AND column_name = 'funding_prazo_atividade'
  ) THEN
    UPDATE public.kanban_cards
    SET prazo_atividade = COALESCE(prazo_atividade, funding_prazo_atividade)
    WHERE funding_prazo_atividade IS NOT NULL
      AND prazo_atividade IS NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.kanban_cards.proxima_atividade IS 'Próxima atividade do card (todos os funis).';
COMMENT ON COLUMN public.kanban_cards.prazo_atividade IS 'Prazo da próxima atividade (todos os funis).';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('430', 'kanban_proxima_atividade_generica')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
