-- Migration 645: faixa de preço e preço médio do condomínio passam a ser moeda.
-- Aplicar DEV primeiro; PROD somente com confirmação explícita.

UPDATE public.formulario_campos AS c
SET config = jsonb_set(
  c.config,
  '{campos}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN item->>'key' IN ('faixa_preco', 'preco_medio_venda')
          THEN jsonb_set(item, '{tipo}', '"moeda"'::jsonb)
        ELSE item
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements(c.config->'campos') WITH ORDINALITY AS t(item, ord)
  )
)
WHERE c.tipo = 'grupo_repetivel'
  AND (
    c.config->'campos' @> '[{"key": "faixa_preco"}]'::jsonb
    OR c.config->'campos' @> '[{"key": "preco_medio_venda"}]'::jsonb
  )
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(c.config->'campos') AS item
    WHERE item->>'key' IN ('faixa_preco', 'preco_medio_venda')
      AND COALESCE(item->>'tipo', '') IS DISTINCT FROM 'moeda'
  );

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('645', 'form_pvp_precos_moeda')
ON CONFLICT (version) DO NOTHING;
