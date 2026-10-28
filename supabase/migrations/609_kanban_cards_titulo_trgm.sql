-- 609: busca de cards para vínculo (ilike no título) em todos os funis.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_titulo_trgm
  ON public.kanban_cards
  USING gin (titulo gin_trgm_ops);

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('609', 'kanban_cards_titulo_trgm')
ON CONFLICT (version) DO NOTHING;
