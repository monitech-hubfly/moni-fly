-- Migration 649: giro de vendas da faixa passa a ser número inteiro.
-- Aplicar DEV primeiro; PROD somente com confirmação explícita.

UPDATE public.formulario_campos AS c
SET config = jsonb_set(
  c.config,
  '{campos}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN item->>'key' = 'giro_vendas'
          THEN jsonb_set(item, '{tipo}', '"numero"'::jsonb)
        ELSE item
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements(c.config->'campos') WITH ORDINALITY AS t(item, ord)
  )
)
WHERE c.tipo = 'grupo_repetivel'
  AND c.config->'campos' @> '[{"key": "giro_vendas"}]'::jsonb
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(c.config->'campos') AS item
    WHERE item->>'key' = 'giro_vendas'
      AND COALESCE(item->>'tipo', '') IS DISTINCT FROM 'numero'
  );

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('649', 'form_pvp_giro_numero')
ON CONFLICT (version) DO NOTHING;
