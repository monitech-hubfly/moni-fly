-- 681: giro de vendas entra no bloco Composição média das casas nessa faixa.
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

UPDATE public.formulario_campos AS c
SET config = jsonb_set(
  c.config,
  '{campos}',
  (
    SELECT COALESCE(jsonb_agg(item ORDER BY pref, ord), '[]'::jsonb)
    FROM jsonb_array_elements(c.config->'campos') WITH ORDINALITY AS t(item, ord)
    CROSS JOIN LATERAL (
      SELECT CASE item->>'key'
        WHEN 'nome' THEN 1
        WHEN 'faixa_preco' THEN 2
        WHEN 'composicao_media' THEN 3
        WHEN 'giro_vendas' THEN 4
        WHEN 'metragem_construida' THEN 5
        WHEN 'num_suites' THEN 6
        WHEN 'possui_piscina' THEN 7
        WHEN 'vagas_cobertas' THEN 8
        WHEN 'preco_medio_venda' THEN 9
        ELSE 50
      END AS pref
    ) AS ordem
  )
)
WHERE c.tipo = 'grupo_repetivel'
  AND c.secao_id = 'sec-pvp-mercado'
  AND c.config->'campos' @> '[{"key": "giro_vendas"}, {"key": "composicao_media"}]'::jsonb
  AND (
    SELECT array_agg(item->>'key' ORDER BY ord)
    FROM jsonb_array_elements(c.config->'campos') WITH ORDINALITY AS t(item, ord)
    WHERE item->>'key' IN ('giro_vendas', 'composicao_media')
  ) IS DISTINCT FROM ARRAY['composicao_media', 'giro_vendas'];

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('681', 'form_pvp_giro_dentro_composicao')
ON CONFLICT (version) DO NOTHING;
