-- 657: tira das respostas da FAQ a citação "esclarecimento documental".
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

UPDATE public.faq_articles
SET answer = replace(answer, 'Segundo o esclarecimento documental, a SPE é responsável', 'A SPE é responsável')
WHERE answer LIKE '%Segundo o esclarecimento documental, a SPE é responsável%';

UPDATE public.faq_articles
SET answer = replace(
  answer,
  'O esclarecimento documental registra que essa condição foi informada incorretamente',
  'Essa condição foi informada incorretamente'
)
WHERE answer LIKE '%O esclarecimento documental registra que essa condição foi informada incorretamente%';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('657', 'faq_remove_esclarecimento_documental')
ON CONFLICT (version) DO NOTHING;
