-- 641: a simulação da jornada guarda o snapshot que o card compara.
-- Substitui jornada_registrar_simulacao (640). Sem coluna nova e sem link público.
-- O resultado deixa de ir vazio: entrada, parcelas, saldo, itens e fluxo ficam no jsonb.
-- Se o template enviado não for o do card de origem, usa o template desse card.
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
  v_token      text;
  v_card_id    uuid;
  v_template   uuid;
  v_condicao   text;
  v_itens      jsonb;
  v_inputs     jsonb;
  v_resultado  jsonb;
  v_id         uuid;
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

  v_inputs := jsonb_strip_nulls(jsonb_build_object(
    'oferta_nome', NULLIF(btrim(COALESCE(p_payload->>'oferta_nome', '')), ''),
    'lote_codigo', NULLIF(btrim(COALESCE(p_payload->>'lote_codigo', '')), ''),
    'lote_rotulo', NULLIF(btrim(COALESCE(p_payload->>'lote_rotulo', '')), ''),
    'slug', NULLIF(btrim(COALESCE(p_payload->>'slug', '')), ''),
    'entrada', v_resultado->'entrada',
    'parcela_mensal', v_resultado->'parcela_mensal',
    'parcela_unica', v_resultado->'parcela_unica',
    'saldo_a_financiar', v_resultado->'saldo_a_financiar',
    'prazo_obra_meses', v_resultado->'prazo_obra_meses',
    'renda', v_resultado->'renda',
    'prazo_financiamento_anos', v_resultado->'prazo_financiamento_anos',
    'taxa_percentual', v_resultado->'taxa_percentual'
  ));

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
    valor_acoplamento,
    valor_ja_pago,
    renda_cliente,
    prazo_meses,
    prazo_financiamento_anos,
    taxa_financiamento_anual,
    customizacao_itens,
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
    NULLIF(p_payload->>'valor_acoplamento', '')::numeric,
    COALESCE((p_payload->>'valor_ja_pago')::numeric, 0),
    NULLIF(p_payload->>'renda_cliente', '')::numeric,
    NULLIF(p_payload->>'prazo_meses', '')::integer,
    NULLIF(p_payload->>'prazo_financiamento_anos', '')::integer,
    NULLIF(p_payload->>'taxa_financiamento_anual', '')::numeric,
    v_itens,
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
  'Grava uma nova simulação da jornada no card VCL do cliente, com snapshot em resultado. Sempre INSERT. SECURITY DEFINER.';

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('641', 'jornada_simulacao_snapshot')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('641')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
