-- 659: remove a pergunta do aporte de R$ 105 mil da Central de Ajuda.
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

DELETE FROM public.faq_articles
WHERE question = 'O aporte de R$ 105 mil para quitação de terreno é um custo padrão?'
   OR slug = 'cm-faq-028';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('659', 'faq_remove_aporte_105')
ON CONFLICT (version) DO NOTHING;
