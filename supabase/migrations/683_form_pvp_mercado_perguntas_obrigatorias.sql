-- 683: todas as perguntas da Pesquisa de Mercado são obrigatórias.
-- O título da composição não é pergunta. Idempotente. DEV primeiro. PROD somente com confirmação explícita.

UPDATE public.formulario_campos AS c
SET config = jsonb_set(
  c.config,
  '{campos}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN COALESCE(item->>'tipo', '') = 'titulo' OR item->>'key' = 'composicao_media' THEN item
        ELSE jsonb_set(item, '{obrigatorio}', 'true'::jsonb)
      END
      ORDER BY ord
    ), '[]'::jsonb)
    FROM jsonb_array_elements(c.config->'campos') WITH ORDINALITY AS t(item, ord)
  )
)
WHERE c.secao_id = 'sec-pvp-mercado'
  AND c.tipo = 'grupo_repetivel'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(c.config->'campos') AS item
    WHERE COALESCE(item->>'tipo', '') IS DISTINCT FROM 'titulo'
      AND item->>'key' IS DISTINCT FROM 'composicao_media'
      AND COALESCE(item->>'obrigatorio', 'false') IS DISTINCT FROM 'true'
  );

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('683', 'form_pvp_mercado_perguntas_obrigatorias')
ON CONFLICT (version) DO NOTHING;
