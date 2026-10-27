-- 664: ajusta a pergunta sobre entrada e saldo em parcelas do terrenista.
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

UPDATE public.faq_articles
SET question = 'É possível oferecer ao terrenista entrada e saldo em parcelas mensais?'
WHERE question = 'É possível oferecer ao terrenista entrada de 20% e saldo em 18 parcelas mensais?';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('664', 'faq_terrenista_parcelas')
ON CONFLICT (version) DO NOTHING;
