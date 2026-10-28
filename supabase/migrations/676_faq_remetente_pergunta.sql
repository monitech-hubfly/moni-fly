-- 676: identifica quem enviou uma pergunta pela Central de Ajuda.
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

ALTER TABLE public.faq_articles
  ADD COLUMN IF NOT EXISTS remetente_nome text,
  ADD COLUMN IF NOT EXISTS remetente_sobrenome text,
  ADD COLUMN IF NOT EXISTS remetente_email text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_articles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_categories TO service_role;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('676', 'faq_remetente_pergunta')
ON CONFLICT (version) DO NOTHING;
