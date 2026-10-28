-- Migration 646: "Composição média das casas nessa faixa" é o tema das perguntas seguintes, não um campo.
-- Aplicar DEV primeiro; PROD somente com confirmação explícita.

UPDATE public.formulario_campos AS c
SET config = jsonb_set(
  c.config,
  '{campos}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN item->>'key' = 'composicao_media'
          THEN jsonb_set(item, '{tipo}', '"titulo"'::jsonb)
        ELSE item
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements(c.config->'campos') WITH ORDINALITY AS t(item, ord)
  )
)
WHERE c.tipo = 'grupo_repetivel'
  AND c.config->'campos' @> '[{"key": "composicao_media"}]'::jsonb
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(c.config->'campos') AS item
    WHERE item->>'key' = 'composicao_media'
      AND COALESCE(item->>'tipo', '') IS DISTINCT FROM 'titulo'
  );

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('646', 'form_pvp_composicao_titulo')
ON CONFLICT (version) DO NOTHING;
