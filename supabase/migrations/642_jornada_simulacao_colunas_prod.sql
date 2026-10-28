-- 642: jornada_registrar_simulacao grava só colunas que existem em PROD.
-- Substitui a versão da 641, que inseria simulacoes_pagamento.valor_acoplamento
-- (migration 571, não aplicada em PROD). Sem coluna nova.
-- Acoplamento, entrada sugerida, parcela única, saldo e fluxo ficam no snapshot
-- (inputs/resultado). nome continua NULL para a lista da Helenna ignorar a jornada.
-- Idempotente. Aplicar em DEV e em PROD. Não faz push até a migration rodar nos dois.

CREATE OR REPLACE FUNCTION public.jornada_registrar_simulacao(
  p_token       text,
  p_card_origem uuid,
  p_payload     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token          text;
  v_card_id        uuid;
  v_template       uuid;
  v_condicao       text;
  v_itens          jsonb;
  v_inputs         jsonb;
  v_resultado      jsonb;
  v_id             uuid;
  v_personalizada  boolean;
  v_parcela_mensal numeric;
  v_entrada_conf   numeric;
  v_mensal_conf    numeric;
  v_unica_conf     numeric;
BEGIN
  v_token := btrim(COALESCE(p_token, ''));
  IF v_token = '' OR p_card_origem IS NULL OR p_payload IS NULL THEN
    RAISE EXCEPTION 'Simulação inválida.';
  END IF;

  SELECT s.vcl_card_id
  INTO v_card_id
  FROM public.jornada_cliente_sessao s
  WHERE s.session_token = v_token
    AND s.card_id = p_card_origem;

  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'Card do cliente ainda não existe. Avance o passo 1 antes de simular.';
  END IF;

  BEGIN
    v_template := NULLIF(btrim(COALESCE(p_payload->>'template_id', '')), '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_template := NULL;
  END;

  IF v_template IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.loteamento_simulador_templates t
    WHERE t.id = v_template
      AND t.kanban_card_id = p_card_origem
  ) THEN
    SELECT t.id
    INTO v_template
    FROM public.loteamento_simulador_templates t
    WHERE t.kanban_card_id = p_card_origem
    LIMIT 1;
  END IF;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template não encontrado para o empreendimento (card %).', p_card_origem;
  END IF;

  v_condicao := COALESCE(NULLIF(btrim(COALESCE(p_payload->>'condicao_lote', '')), ''), 'nao_pago');
  IF v_condicao NOT IN ('nao_pago', 'parcial', 'quitado', 'recurso_proprio') THEN
    v_condicao := 'nao_pago';
  END IF;

  v_itens := COALESCE(p_payload->'customizacao_itens', '[]'::jsonb);
  IF jsonb_typeof(v_itens) IS DISTINCT FROM 'array' THEN
    v_itens := '[]'::jsonb;
  END IF;

  v_resultado := p_payload->'resultado';
  IF v_resultado IS NULL OR jsonb_typeof(v_resultado) IS DISTINCT FROM 'object' THEN
    v_resultado := '{}'::jsonb;
  END IF;

  -- Acoplamento não tem coluna em PROD. Garante a chave no snapshot.
  IF v_resultado->'acoplamento' IS NULL
     AND NULLIF(btrim(COALESCE(p_payload->>'valor_acoplamento', '')), '') IS NOT NULL THEN
    v_resultado := v_resultado || jsonb_build_object(
      'acoplamento', (p_payload->>'valor_acoplamento')::numeric
    );
  END IF;

  v_personalizada := lower(COALESCE(p_payload->>'personalizada', 'false')) IN ('true', 't', '1');
  v_parcela_mensal := COALESCE(
    NULLIF(p_payload->>'parcela_mensal', '')::numeric,
    NULLIF(v_resultado->>'parcela_mensal', '')::numeric
  );
  v_entrada_conf := CASE
    WHEN v_personalizada THEN NULLIF(p_payload->>'entrada_confirmada', '')::numeric
    ELSE NULL
  END;
  v_mensal_conf := CASE
    WHEN v_personalizada THEN NULLIF(p_payload->>'parcela_mensal_confirmada', '')::numeric
    ELSE NULL
  END;
  v_unica_conf := CASE
    WHEN v_personalizada THEN NULLIF(p_payload->>'parcela_unica_confirmada', '')::numeric
    ELSE NULL
  END;

  v_inputs := jsonb_strip_nulls(jsonb_build_object(
    'oferta_nome', NULLIF(btrim(COALESCE(p_payload->>'oferta_nome', '')), ''),
    'lote_codigo', NULLIF(btrim(COALESCE(p_payload->>'lote_codigo', '')), ''),
    'lote_rotulo', NULLIF(btrim(COALESCE(p_payload->>'lote_rotulo', '')), ''),
    'slug', NULLIF(btrim(COALESCE(p_payload->>'slug', '')), ''),
    'acoplamento', v_resultado->'acoplamento',
    'entrada', v_resultado->'entrada',
    'parcela_mensal', to_jsonb(v_parcela_mensal),
    'parcela_unica', v_resultado->'parcela_unica',
    'saldo_a_financiar', v_resultado->'saldo_a_financiar',
    'prazo_obra_meses', v_resultado->'prazo_obra_meses',
    'renda', v_resultado->'renda',
    'prazo_financiamento_anos', v_resultado->'prazo_financiamento_anos',
    'taxa_percentual', v_resultado->'taxa_percentual',
    'fluxo', v_resultado->'fluxo',
    'entrada_confirmada', to_jsonb(v_entrada_conf),
    'parcela_mensal_confirmada', to_jsonb(v_mensal_conf),
    'parcela_unica_confirmada', to_jsonb(v_unica_conf)
  ));

  -- Colunas, na ordem, contra o schema de PROD. Nenhuma coluna da 571.
  INSERT INTO public.simulacoes_pagamento (
    template_id,
    kanban_card_id,
    created_by,
    nome,
    condicao_lote,
    cliente_nome,
    cliente_telefone,
    valor_lote,
    valor_casa,
    valor_customizacao,
    valor_ja_pago,
    renda_cliente,
    renda_informada_cliente,
    prazo_meses,
    prazo_financiamento_anos,
    taxa_financiamento_anual,
    parcela_mensal,
    customizacao_itens,
    personalizada,
    entrada_confirmada,
    parcela_mensal_confirmada,
    parcela_unica_confirmada,
    inputs,
    resultado,
    status
  ) VALUES (
    v_template,
    v_card_id,
    NULL,
    NULL,
    v_condicao,
    NULLIF(btrim(COALESCE(p_payload->>'cliente_nome', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'cliente_telefone', '')), ''),
    COALESCE((p_payload->>'valor_lote')::numeric, 0),
    COALESCE((p_payload->>'valor_casa')::numeric, 0),
    COALESCE((p_payload->>'valor_customizacao')::numeric, 0),
    COALESCE((p_payload->>'valor_ja_pago')::numeric, 0),
    NULLIF(p_payload->>'renda_cliente', '')::numeric,
    NULLIF(p_payload->>'renda_cliente', '')::numeric,
    NULLIF(p_payload->>'prazo_meses', '')::integer,
    NULLIF(p_payload->>'prazo_financiamento_anos', '')::integer,
    NULLIF(p_payload->>'taxa_financiamento_anual', '')::numeric,
    v_parcela_mensal,
    v_itens,
    v_personalizada,
    v_entrada_conf,
    v_mensal_conf,
    v_unica_conf,
    v_inputs,
    v_resultado,
    'rascunho'
  )
  RETURNING id INTO v_id;

  UPDATE public.jornada_cliente_sessao
  SET simulacao_id = v_id,
      updated_at = now()
  WHERE session_token = v_token
    AND card_id = p_card_origem;

  RETURN jsonb_build_object('id', v_id, 'card_id', v_card_id);
END;
$$;

REVOKE ALL ON FUNCTION public.jornada_registrar_simulacao(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jornada_registrar_simulacao(text, uuid, jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.jornada_registrar_simulacao IS
  'Grava uma nova simulação da jornada no card VCL. Só colunas existentes em PROD; acoplamento e fluxo ficam no snapshot. Sempre INSERT. SECURITY DEFINER.';

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('642', 'jornada_simulacao_colunas_prod')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('642')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
