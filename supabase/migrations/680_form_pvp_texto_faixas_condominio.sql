-- 680: novo texto da pesquisa de condomínios na Validação de Praça.
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

UPDATE public.formulario_campos
SET nome = $txt$Quais condomínios de alto padrão você considera mais interessantes para prospectar terrenos? Desejável pelo menos 3 condomínios.

Ao colocar a faixa de preço, o formulário será dividido em blocos por faixa e as respostas devem ser considerando a faixa em questão. Logo, é necessário mais de um preenchimento por condomínio, considerando que abrange perfis de consumo diferentes por faixa de preço.$txt$
WHERE secao_id = 'sec-pvp-mercado'
  AND tipo = 'grupo_repetivel'
  AND nome IS DISTINCT FROM $txt$Quais condomínios de alto padrão você considera mais interessantes para prospectar terrenos? Desejável pelo menos 3 condomínios.

Ao colocar a faixa de preço, o formulário será dividido em blocos por faixa e as respostas devem ser considerando a faixa em questão. Logo, é necessário mais de um preenchimento por condomínio, considerando que abrange perfis de consumo diferentes por faixa de preço.$txt$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('680', 'form_pvp_texto_faixas_condominio')
ON CONFLICT (version) DO NOTHING;
