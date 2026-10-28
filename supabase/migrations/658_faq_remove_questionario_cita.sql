-- 658: tira das respostas da FAQ a citação "O questionário cita".
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

UPDATE public.faq_articles
SET answer = replace(
  answer,
  'O questionário cita carga efetiva estimada de 3% a 5% sobre o VGV no Lucro Presumido.',
  'A carga efetiva estimada é de 3% a 5% sobre o VGV no Lucro Presumido.'
)
WHERE answer LIKE '%O questionário cita carga efetiva estimada%';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('658', 'faq_remove_questionario_cita')
ON CONFLICT (version) DO NOTHING;
