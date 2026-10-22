-- Migration 643: opção Outro na pergunta de vínculo com a região.
-- Ao escolher Outro, abre um texto curto obrigatório.
-- Aplicar DEV primeiro; PROD somente com confirmação explícita.

UPDATE public.formulario_campos
SET opcoes = '["Resido", "Possuo relacionamento profissional", "Outro"]'::jsonb
WHERE secao_id = 'sec-pvp-praca'
  AND nome = 'Você reside ou possui relacionamento profissional nessa região?';

INSERT INTO public.formulario_campos (
  id, secao_id, nome, tipo, ordem, obrigatorio, opcoes, condicional_campo_id, condicional_valor
)
SELECT
  'campo-pvp-outro-regiao',
  'sec-pvp-praca',
  'Especifique',
  'texto_curto',
  5,
  true,
  '[]'::jsonb,
  p.id,
  'Outro'
FROM public.formulario_campos p
WHERE p.secao_id = 'sec-pvp-praca'
  AND p.nome = 'Você reside ou possui relacionamento profissional nessa região?'
  AND NOT EXISTS (
    SELECT 1 FROM public.formulario_campos WHERE id = 'campo-pvp-outro-regiao'
  )
LIMIT 1;

UPDATE public.formulario_campos AS c
SET
  tipo = 'texto_curto',
  nome = 'Especifique',
  obrigatorio = true,
  ordem = 5,
  condicional_valor = 'Outro',
  condicional_campo_id = p.id
FROM public.formulario_campos p
WHERE c.id = 'campo-pvp-outro-regiao'
  AND p.secao_id = 'sec-pvp-praca'
  AND p.nome = 'Você reside ou possui relacionamento profissional nessa região?';

UPDATE public.formulario_campos AS c
SET ordem = v.ordem
FROM (
  VALUES
    ('sec-pvp-praca', 'Você reside ou possui relacionamento profissional nessa região?', 4),
    ('sec-pvp-praca', 'Especifique', 5),
    ('sec-pvp-praca', 'Como pretende atuar presencialmente?', 6)
) AS v(secao_id, nome, ordem)
WHERE c.secao_id = v.secao_id
  AND c.nome = v.nome
  AND c.ordem IS DISTINCT FROM v.ordem;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('643', 'form_pvp_outro_regiao')
ON CONFLICT (version) DO NOTHING;
