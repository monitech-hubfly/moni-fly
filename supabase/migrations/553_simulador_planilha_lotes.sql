-- 553: Simulador público lê a planilha de lotes (path no RPC + download no Storage).
-- Depende da 552 (colunas planilha_lotes_* em imob_card_modelo).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Não aplicar em PROD sem revisão da Ingrid.

CREATE OR REPLACE FUNCTION public.simulador_publico_carregar(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tpl jsonb;
  v_lotes jsonb;
  v_planilha jsonb;
  v_token text := btrim(COALESCE(p_token, ''));
BEGIN
  IF v_token = '' THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(t) INTO v_tpl
  FROM public.loteamento_simulador_templates t
  WHERE t.link_token = v_token
     OR (
       v_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       AND t.id = v_token::uuid
     )
  LIMIT 1;

  IF v_tpl IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', l.id, 'codigo', l.codigo, 'valor', l.valor)
      ORDER BY l.codigo
    ),
    '[]'::jsonb
  )
  INTO v_lotes
  FROM public.lotes_template l
  WHERE l.template_id = (v_tpl->>'id')::uuid
    AND l.disponivel IS TRUE;

  v_planilha := NULL;
  IF NULLIF(v_tpl->>'kanban_card_id', '') IS NOT NULL THEN
    BEGIN
      SELECT jsonb_build_object(
        'path', NULLIF(btrim(COALESCE(m.planilha_lotes_path, '')), ''),
        'nome', NULLIF(btrim(COALESCE(m.planilha_lotes_nome, '')), '')
      )
      INTO v_planilha
      FROM public.imob_card_modelo m
      WHERE m.card_id = (v_tpl->>'kanban_card_id')::uuid
      LIMIT 1;
      IF v_planilha IS NULL OR v_planilha->>'path' IS NULL THEN
        v_planilha := NULL;
      END IF;
    EXCEPTION
      WHEN undefined_column THEN
        v_planilha := NULL;
      WHEN undefined_table THEN
        v_planilha := NULL;
    END;
  END IF;

  RETURN jsonb_build_object('template', v_tpl, 'lotes', v_lotes, 'planilha', v_planilha);
END;
$$;

REVOKE ALL ON FUNCTION public.simulador_publico_carregar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.simulador_publico_carregar(text) TO anon, authenticated, service_role;

-- Página pública do corretor precisa baixar o arquivo (bucket privado).
DROP POLICY IF EXISTS "Anon pode ler planilha de lotes" ON storage.objects;
CREATE POLICY "Anon pode ler planilha de lotes"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'processo-docs'
  AND name LIKE '%/imob/planilha-lotes/%'
);

NOTIFY pgrst, 'reload schema';
