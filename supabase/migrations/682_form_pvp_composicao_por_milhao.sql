-- 682: faixa de preço obrigatória; o formulário abre uma composição a cada R$ 1 milhão.
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

UPDATE public.formulario_campos AS c
SET nome = $txt$Quais condomínios de alto padrão você considera mais interessantes para prospectar terrenos? Desejável pelo menos 3 condomínios.

Ao colocar a faixa de preço, o formulário cria uma composição média para cada intervalo de R$ 1 milhão. As respostas de cada bloco devem considerar a faixa indicada.$txt$,
    config = jsonb_set(
      c.config,
      '{campos}',
      (
        SELECT COALESCE(jsonb_agg(
          CASE
            WHEN item->>'key' = 'faixa_preco' THEN jsonb_set(item, '{obrigatorio}', 'true'::jsonb)
            ELSE item
          END
          ORDER BY ord
        ), '[]'::jsonb)
        FROM jsonb_array_elements(c.config->'campos') WITH ORDINALITY AS t(item, ord)
      )
    )
WHERE c.secao_id = 'sec-pvp-mercado'
  AND c.tipo = 'grupo_repetivel';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('682', 'form_pvp_composicao_por_milhao')
ON CONFLICT (version) DO NOTHING;
