-- 687: cada condomínio da validação de praça ganha metragem, preço e origem da pesquisa dos lotes.
-- Idempotente. Não apaga respostas já enviadas.

UPDATE public.formulario_campos AS c
SET config = jsonb_set(
  c.config,
  '{campos}',
  (
    SELECT COALESCE(jsonb_agg(item ORDER BY ord), '[]'::jsonb)
    FROM (
      SELECT item, ord::numeric AS ord
      FROM jsonb_array_elements(COALESCE(c.config->'campos', '[]'::jsonb)) WITH ORDINALITY AS t(item, ord)
      WHERE COALESCE(item->>'key', '') NOT IN (
        'metragem_media_lotes',
        'preco_medio_lotes',
        'diferencas_preco_terreno',
        'fonte_pesquisa_lotes'
      )
      UNION ALL
      SELECT novos.item, base.ord + novos.deslocamento
      FROM (
        SELECT COALESCE(
          (
            SELECT t.ord
            FROM jsonb_array_elements(COALESCE(c.config->'campos', '[]'::jsonb)) WITH ORDINALITY AS t(item, ord)
            WHERE t.item->>'key' = 'faixa_preco'
            LIMIT 1
          ),
          2
        ) AS ord
      ) AS base
      CROSS JOIN (
        VALUES
          (
            0.1,
            jsonb_build_object(
              'key', 'metragem_media_lotes',
              'label', 'Qual é a metragem média dos lotes disponíveis?',
              'tipo', 'm2',
              'obrigatorio', true
            )
          ),
          (
            0.2,
            jsonb_build_object(
              'key', 'preco_medio_lotes',
              'label', 'Qual é o preço médio de venda dos lotes?',
              'tipo', 'moeda',
              'obrigatorio', true
            )
          ),
          (
            0.3,
            jsonb_build_object(
              'key', 'diferencas_preco_terreno',
              'label', 'Existem diferenças relevantes de preço conforme localização, tamanho ou características do terreno?',
              'tipo', 'texto_longo',
              'obrigatorio', true
            )
          ),
          (
            0.4,
            jsonb_build_object(
              'key', 'fonte_pesquisa_lotes',
              'label', 'Onde você pesquisou essas informações? (Imobiliárias, corretores, portais imobiliários, visitas, contatos locais etc.)',
              'tipo', 'texto_longo',
              'obrigatorio', true
            )
          )
      ) AS novos(deslocamento, item)
    ) AS lista
  )
)
WHERE c.secao_id = 'sec-pvp-mercado'
  AND c.tipo = 'grupo_repetivel';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('687', 'form_pvp_lotes_condominio')
ON CONFLICT (version) DO NOTHING;
