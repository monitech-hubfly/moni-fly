-- Migration 644: metragem construída do condomínio passa a ser área decimal em m².
-- Aplicar DEV primeiro; PROD somente com confirmação explícita.

UPDATE public.formulario_campos AS c
SET config = jsonb_set(
  c.config,
  '{campos}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN item->>'key' = 'metragem_construida'
          THEN jsonb_set(item, '{tipo}', '"m2"'::jsonb)
        ELSE item
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements(c.config->'campos') WITH ORDINALITY AS t(item, ord)
  )
)
WHERE c.tipo = 'grupo_repetivel'
  AND c.config->'campos' @> '[{"key": "metragem_construida"}]'::jsonb
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(c.config->'campos') AS item
    WHERE item->>'key' = 'metragem_construida'
      AND COALESCE(item->>'tipo', '') IS DISTINCT FROM 'm2'
  );

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('644', 'form_pvp_metragem_m2')
ON CONFLICT (version) DO NOTHING;
