-- Leitura do FAQ para autenticados: artigos publicados visíveis a frank/todos
-- e categorias ativas. Idempotente. Não altera colunas nem conteúdo.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'faq_articles'
      AND policyname = 'frank_can_read_faq'
  ) THEN
    CREATE POLICY frank_can_read_faq ON public.faq_articles
      FOR SELECT TO authenticated
      USING (
        status = 'published'
        AND (
          'frank' = ANY (COALESCE(visibility, ARRAY[]::text[]))
          OR 'todos' = ANY (COALESCE(visibility, ARRAY[]::text[]))
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'faq_categories'
      AND policyname = 'frank_can_read_faq'
  ) THEN
    CREATE POLICY frank_can_read_faq ON public.faq_categories
      FOR SELECT TO authenticated
      USING (is_active = true);
  END IF;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('577', 'faq_frank_select')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
