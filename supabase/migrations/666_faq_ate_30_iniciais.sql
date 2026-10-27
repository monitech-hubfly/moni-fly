-- 666: ajusta a pergunta sobre o pagamento inicial na compra parcial.
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

UPDATE public.faq_articles
SET question = 'Quando são pagos os até 30% iniciais na compra parcial?'
WHERE question = 'Quando são pagos os 30% iniciais na compra parcial?';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('666', 'faq_ate_30_iniciais')
ON CONFLICT (version) DO NOTHING;
