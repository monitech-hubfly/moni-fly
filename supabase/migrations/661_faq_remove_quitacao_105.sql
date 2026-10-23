-- 661: remove a pergunta dos R$ 105 mil de quitação de terreno.
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

DELETE FROM public.faq_articles
WHERE question = 'Os R$ 105 mil de quitação de terreno se aplicam a todas as operações?'
   OR slug = 'cm-faq-032';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('661', 'faq_remove_quitacao_105')
ON CONFLICT (version) DO NOTHING;
