-- Migration 648: orienta a repetir o condomínio quando houver mais de uma faixa de preço.
-- Aplicar DEV primeiro; PROD somente com confirmação explícita.

UPDATE public.formulario_campos
SET nome = 'Quais condomínios de alto padrão você considera mais interessantes para prospectar terrenos? Desejável pelo menos 3 condomínios. Se um condomínio tiver mais de uma faixa de preço, deve ser preenchido mais de uma vez, considerando um preenchimento para cada faixa de preço do condomínio.'
WHERE secao_id = 'sec-pvp-mercado'
  AND tipo = 'grupo_repetivel'
  AND nome IS DISTINCT FROM 'Quais condomínios de alto padrão você considera mais interessantes para prospectar terrenos? Desejável pelo menos 3 condomínios. Se um condomínio tiver mais de uma faixa de preço, deve ser preenchido mais de uma vez, considerando um preenchimento para cada faixa de preço do condomínio.';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('648', 'form_pvp_instrucao_faixas')
ON CONFLICT (version) DO NOTHING;
