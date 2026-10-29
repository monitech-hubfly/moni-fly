-- 678: Praça de atuação aceita vários estados e várias cidades.
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

UPDATE public.formulario_campos
SET
  nome = 'Estados aonde pretende atuar',
  config = COALESCE(config, '{}'::jsonb) || '{"multiplo": true}'::jsonb
WHERE secao_id = 'sec-pvp-praca'
  AND (
    id = 'campo-pvp-estado-praca'
    OR nome IN ('Estado aonde pretende atuar', 'Estados aonde pretende atuar')
  )
  AND (
    nome IS DISTINCT FROM 'Estados aonde pretende atuar'
    OR COALESCE(config, '{}'::jsonb) ->> 'multiplo' IS DISTINCT FROM 'true'
  );

UPDATE public.formulario_campos
SET
  nome = 'Em quais cidades pretende atuar com a franquia MONÍ?',
  config = COALESCE(config, '{}'::jsonb) || '{"multiplo": true}'::jsonb
WHERE secao_id = 'sec-pvp-praca'
  AND tipo = 'select_cidade'
  AND (
    nome IS DISTINCT FROM 'Em quais cidades pretende atuar com a franquia MONÍ?'
    OR COALESCE(config, '{}'::jsonb) ->> 'multiplo' IS DISTINCT FROM 'true'
  );

UPDATE public.formulario_campos
SET nome = 'Por que escolheu essas cidades?'
WHERE secao_id = 'sec-pvp-praca'
  AND nome = 'Por que escolheu essa cidade?';

UPDATE public.formulario_campos
SET nome = 'Você reside ou possui relacionamento profissional nessas regiões?'
WHERE secao_id = 'sec-pvp-praca'
  AND nome = 'Você reside ou possui relacionamento profissional nessa região?';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('678', 'form_pvp_estados_cidades_multiplos')
ON CONFLICT (version) DO NOTHING;
