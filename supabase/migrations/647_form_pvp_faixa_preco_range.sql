-- Migration 647: faixa de preço de venda é um intervalo (de / à), não um valor único.
-- Aplicar DEV primeiro; PROD somente com confirmação explícita.

UPDATE public.formulario_campos AS c
SET config = jsonb_set(
  c.config,
  '{campos}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN item->>'key' = 'faixa_preco'
          THEN jsonb_set(item, '{tipo}', '"faixa_moeda"'::jsonb)
        ELSE item
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements(c.config->'campos') WITH ORDINALITY AS t(item, ord)
  )
)
WHERE c.tipo = 'grupo_repetivel'
  AND c.config->'campos' @> '[{"key": "faixa_preco"}]'::jsonb
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(c.config->'campos') AS item
    WHERE item->>'key' = 'faixa_preco'
      AND COALESCE(item->>'tipo', '') IS DISTINCT FROM 'faixa_moeda'
  );

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('647', 'form_pvp_faixa_preco_range')
ON CONFLICT (version) DO NOTHING;
