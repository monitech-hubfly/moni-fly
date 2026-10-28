-- 677: guarda quem enviou a pergunta da Central de Ajuda (Candidato, Terrenista, etc.).
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

ALTER TABLE public.faq_articles
  ADD COLUMN IF NOT EXISTS remetente_perfil text,
  ADD COLUMN IF NOT EXISTS remetente_perfil_outro text;

ALTER TABLE public.faq_articles
  DROP CONSTRAINT IF EXISTS faq_articles_remetente_perfil_check;

ALTER TABLE public.faq_articles
  ADD CONSTRAINT faq_articles_remetente_perfil_check
  CHECK (
    remetente_perfil IS NULL
    OR remetente_perfil IN (
      'Candidato',
      'Terrenista',
      'Franqueado',
      'Fornecedor',
      'Investidor',
      'Outro'
    )
  );

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('677', 'faq_remetente_perfil')
ON CONFLICT (version) DO NOTHING;
