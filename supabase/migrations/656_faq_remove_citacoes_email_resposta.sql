-- 656: tira das respostas da FAQ as citações "segundo o e-mail fornecido" e "segundo/conforme a resposta comercial".
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

UPDATE public.faq_articles
SET answer = replace(answer, 'Conforme a resposta comercial, o resultado', 'O resultado')
WHERE answer LIKE '%Conforme a resposta comercial, o resultado%';

UPDATE public.faq_articles
SET answer = replace(answer, 'Na reunião de Comitê, conforme a resposta comercial, são apresentados', 'Na reunião de Comitê, são apresentados')
WHERE answer LIKE '%conforme a resposta comercial, são apresentados%';

UPDATE public.faq_articles
SET answer = replace(answer, 'Segundo a resposta comercial, o pagamento', 'O pagamento')
WHERE answer LIKE '%Segundo a resposta comercial, o pagamento%';

UPDATE public.faq_articles
SET answer = replace(answer, 'Segundo o e-mail fornecido, nenhum', 'Nenhum')
WHERE answer LIKE '%Segundo o e-mail fornecido, nenhum%';

UPDATE public.faq_articles
SET answer = replace(answer, 'Sim. Conforme a resposta comercial, os esclarecimentos', 'Sim. Os esclarecimentos')
WHERE answer LIKE '%Conforme a resposta comercial, os esclarecimentos%';

UPDATE public.faq_articles
SET answer = replace(
  answer,
  'A resposta comercial indica a disponibilização de uma ferramenta',
  'É disponibilizada uma ferramenta'
)
WHERE answer LIKE '%A resposta comercial indica a disponibilização de uma ferramenta%';

UPDATE public.faq_articles
SET answer = replace(
  answer,
  'A resposta comercial cita Simples Nacional para a Gestora e Lucro Presumido para a Incorporadora como práticas comuns, não como obrigações.',
  'Simples Nacional para a Gestora e Lucro Presumido para a Incorporadora são práticas comuns, não obrigações.'
)
WHERE answer LIKE '%A resposta comercial cita Simples Nacional%';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('656', 'faq_remove_citacoes_email_resposta')
ON CONFLICT (version) DO NOTHING;
