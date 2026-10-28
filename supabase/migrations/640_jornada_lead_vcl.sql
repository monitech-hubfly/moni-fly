-- 640: Jornada pública cria/reaproveita card em Venda Casas Loteadores.
-- Visitante anônimo chama as RPCs (SECURITY DEFINER). Sem GRANT de INSERT nas tabelas.
-- Kanbans e a fase Leads são resolvidos pelo nome/slug, não por id fixo.
--
-- SELECT de verificação (só leitura) antes de aplicar em PROD:
--
-- SELECT k.nome AS kanban, k.ativo AS kanban_ativo, f.nome AS fase, f.slug, f.ordem, f.ativo AS fase_ativa
-- FROM public.kanbans k
-- LEFT JOIN public.kanban_fases f
--   ON f.kanban_id = k.id
--  AND (f.slug = 'vcl_leads' OR lower(btrim(f.nome)) = 'leads')
-- WHERE k.nome IN (
--   'Venda Casas Loteadores - Lotes Não Vendidos',
--   'Venda Casas Loteadores - Lotes Vendidos',
--   'Venda Casas Loteadores - Showroom'
-- )
-- ORDER BY k.nome, f.ordem;

-- ─── Índice do telefone (só dígitos) ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kanban_cards_vc_telefone_digitos
  ON public.kanban_cards (regexp_replace(COALESCE(vc_telefone, ''), '\D', '', 'g'))
  WHERE vc_telefone IS NOT NULL AND btrim(vc_telefone) <> '';

-- ─── Lead: nasce ou reaproveita pelo telefone ───────────────────────────────
CREATE OR REPLACE FUNCTION public.jornada_registrar_lead(
  p_token            text,
  p_card_origem      uuid,
  p_nome             text,
  p_telefone         text,
  p_slug             text,
  p_corretor_id      uuid,
  p_loteamento_nome  text,
  p_mover            boolean,
  p_ja_tem_lote      boolean,
  p_dados            jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token        text;
  v_slug         text;
  v_nome         text;
  v_tel          text;
  v_tel_raw      text;
  v_franqueado   uuid;
  v_loteamento   text;
  v_emp_id       uuid;
  v_corretor     uuid;
  v_kanban_nao   uuid;
  v_kanban_vend  uuid;
  v_kanban_show  uuid;
  v_kanban_dest  uuid;
  v_fase_dest    uuid;
  v_card_id      uuid;
  v_kanban_atual uuid;
  v_em_leads     boolean := false;
  v_corretor_atual uuid;
  v_criado       boolean := false;
  v_movido       boolean := false;
  v_tag_id       uuid;
  v_lote_codigo  text;
  v_lote_valor   text;
  v_nome_nao     text := 'Venda Casas Loteadores - Lotes Não Vendidos';
  v_nome_vend    text := 'Venda Casas Loteadores - Lotes Vendidos';
  v_nome_show    text := 'Venda Casas Loteadores - Showroom';
BEGIN
  v_token := btrim(COALESCE(p_token, ''));
  v_slug := lower(btrim(COALESCE(p_slug, '')));
  v_nome := btrim(COALESCE(p_nome, ''));
  v_tel_raw := btrim(COALESCE(p_telefone, ''));
  v_tel := regexp_replace(v_tel_raw, '\D', '', 'g');
  IF length(v_tel) > 11 AND left(v_tel, 2) = '55' THEN
    v_tel := right(v_tel, 11);
  END IF;

  IF v_token = '' OR p_card_origem IS NULL THEN
    RAISE EXCEPTION 'Sessão da jornada inválida.';
  END IF;
  IF v_slug = '' THEN
    RAISE EXCEPTION 'Empreendimento da jornada inválido.';
  END IF;
  IF length(v_nome) < 2 THEN
    RAISE EXCEPTION 'Informe o nome do cliente.';
  END IF;
  IF length(v_tel) < 10 THEN
    RAISE EXCEPTION 'Informe um telefone válido.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jornada_cliente_sessao s
    WHERE s.session_token = v_token
      AND s.card_id = p_card_origem
  ) THEN
    RAISE EXCEPTION 'Sessão da jornada não encontrada.';
  END IF;

  SELECT kc.franqueado_id
  INTO v_franqueado
  FROM public.kanban_cards kc
  JOIN public.imob_card_modelo icm ON icm.card_id = kc.id
  WHERE kc.id = p_card_origem
    AND icm.page_slug IS NOT NULL
    AND lower(btrim(icm.page_slug)) = v_slug
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empreendimento não encontrado para este slug.';
  END IF;
  IF v_franqueado IS NULL THEN
    RAISE EXCEPTION 'Card de origem sem franqueado_id. Lead não criado.';
  END IF;

  SELECT COALESCE(
    NULLIF(btrim(kc.nome_condominio), ''),
    NULLIF(btrim(ie.nome), ''),
    NULLIF(btrim(icm.page_titulo), ''),
    NULLIF(btrim(p_loteamento_nome), ''),
    NULLIF(v_slug, '')
  )
  INTO v_loteamento
  FROM public.kanban_cards kc
  JOIN public.imob_card_modelo icm ON icm.card_id = kc.id
  LEFT JOIN public.imob_empreendimentos ie
    ON ie.card_id = kc.id
    OR lower(btrim(COALESCE(ie.slug, ''))) = v_slug
  WHERE kc.id = p_card_origem
  ORDER BY CASE WHEN ie.card_id = kc.id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_loteamento IS NULL OR btrim(v_loteamento) = '' THEN
    v_loteamento := v_slug;
  END IF;

  SELECT ie.id
  INTO v_emp_id
  FROM public.imob_empreendimentos ie
  WHERE ie.card_id = p_card_origem
     OR lower(btrim(COALESCE(ie.slug, ''))) = v_slug
  ORDER BY CASE WHEN ie.card_id = p_card_origem THEN 0 ELSE 1 END
  LIMIT 1;

  v_corretor := NULL;
  IF p_corretor_id IS NOT NULL THEN
    SELECT r.id INTO v_corretor
    FROM public.rede_corretores r
    WHERE r.id = p_corretor_id;
  END IF;

  SELECT id INTO v_kanban_nao
  FROM public.kanbans
  WHERE nome = v_nome_nao
  ORDER BY CASE WHEN COALESCE(ativo, true) THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT id INTO v_kanban_vend
  FROM public.kanbans
  WHERE nome = v_nome_vend
  ORDER BY CASE WHEN COALESCE(ativo, true) THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT id INTO v_kanban_show
  FROM public.kanbans
  WHERE nome = v_nome_show
  ORDER BY CASE WHEN COALESCE(ativo, true) THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_nao IS NULL OR v_kanban_vend IS NULL OR v_kanban_show IS NULL THEN
    RAISE EXCEPTION 'Kanban Venda Casas Loteadores não encontrado.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('jornada-vcl-' || v_tel)::bigint);

  SELECT c.id, c.kanban_id,
         (f.slug = 'vcl_leads' OR lower(btrim(f.nome)) = 'leads'),
         c.rede_corretor_id
  INTO v_card_id, v_kanban_atual, v_em_leads, v_corretor_atual
  FROM public.kanban_cards c
  JOIN public.kanban_fases f ON f.id = c.fase_id
  WHERE c.kanban_id IN (v_kanban_nao, v_kanban_vend, v_kanban_show)
    AND COALESCE(c.arquivado, false) = false
    AND regexp_replace(COALESCE(c.vc_telefone, ''), '\D', '', 'g') IN (v_tel, '55' || v_tel)
  ORDER BY CASE WHEN f.slug = 'vcl_leads' OR lower(btrim(f.nome)) = 'leads' THEN 0 ELSE 1 END,
           c.created_at DESC
  LIMIT 1;

  IF v_card_id IS NULL THEN
    SELECT f.id INTO v_fase_dest
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_kanban_vend
      AND COALESCE(f.ativo, true) = true
      AND (f.slug = 'vcl_leads' OR lower(btrim(f.nome)) = 'leads')
    ORDER BY CASE WHEN f.slug = 'vcl_leads' THEN 0 ELSE 1 END, f.ordem
    LIMIT 1;

    IF v_fase_dest IS NULL THEN
      RAISE EXCEPTION 'Fase Leads de Lotes Vendidos não encontrada.';
    END IF;

    INSERT INTO public.kanban_cards (
      titulo,
      kanban_id,
      fase_id,
      franqueado_id,
      status,
      nome_condominio,
      vc_dono_terreno,
      vc_telefone,
      imob_empreendimento_id,
      rede_corretor_id,
      vc_observacao,
      entered_fase_at
    ) VALUES (
      v_nome,
      v_kanban_vend,
      v_fase_dest,
      v_franqueado,
      'ativo',
      v_loteamento,
      v_nome,
      v_tel_raw,
      v_emp_id,
      v_corretor,
      'Lead da jornada pública /empreendimento/' || v_slug || '.',
      now()
    )
    RETURNING id, kanban_id INTO v_card_id, v_kanban_atual;

    v_em_leads := true;
    v_criado := true;
  ELSE
    UPDATE public.kanban_cards
    SET
      titulo = CASE WHEN v_em_leads THEN v_nome ELSE titulo END,
      vc_dono_terreno = CASE
        WHEN v_em_leads THEN v_nome
        ELSE COALESCE(vc_dono_terreno, v_nome)
      END,
      vc_telefone = COALESCE(NULLIF(btrim(vc_telefone), ''), v_tel_raw),
      imob_empreendimento_id = COALESCE(imob_empreendimento_id, v_emp_id),
      rede_corretor_id = COALESCE(rede_corretor_id, v_corretor),
      nome_condominio = COALESCE(NULLIF(btrim(nome_condominio), ''), v_loteamento)
    WHERE id = v_card_id;
  END IF;

  -- Tag do loteamento no kanban em que o card está agora. Cor navy, não o laranja default.
  INSERT INTO public.kanban_tags (kanban_id, nome, cor)
  VALUES (v_kanban_atual, v_loteamento, '#0C2633')
  ON CONFLICT (kanban_id, nome) DO UPDATE
  SET cor = CASE
    WHEN lower(kanban_tags.cor) IN ('#f5a623', '#ff9800', '#f97316') THEN EXCLUDED.cor
    ELSE kanban_tags.cor
  END;

  SELECT id INTO v_tag_id
  FROM public.kanban_tags
  WHERE kanban_id = v_kanban_atual AND nome = v_loteamento;

  IF v_tag_id IS NOT NULL THEN
    INSERT INTO public.kanban_card_tags (card_id, tag_id)
    VALUES (v_card_id, v_tag_id)
    ON CONFLICT (card_id, tag_id) DO NOTHING;
  END IF;

  -- Passo 3: só move entre kanbans se o card ainda está em Leads.
  IF COALESCE(p_mover, false) AND v_em_leads THEN
    v_kanban_dest := CASE
      WHEN COALESCE(p_ja_tem_lote, false) THEN v_kanban_vend
      ELSE v_kanban_nao
    END;

    IF v_kanban_dest IS DISTINCT FROM v_kanban_atual THEN
      SELECT f.id INTO v_fase_dest
      FROM public.kanban_fases f
      WHERE f.kanban_id = v_kanban_dest
        AND COALESCE(f.ativo, true) = true
        AND (f.slug = 'vcl_leads' OR lower(btrim(f.nome)) = 'leads')
      ORDER BY CASE WHEN f.slug = 'vcl_leads' THEN 0 ELSE 1 END, f.ordem
      LIMIT 1;

      IF v_fase_dest IS NULL THEN
        RAISE EXCEPTION 'Fase Leads do kanban de destino não encontrada.';
      END IF;

      UPDATE public.kanban_cards
      SET kanban_id = v_kanban_dest,
          fase_id = v_fase_dest,
          entered_fase_at = now()
      WHERE id = v_card_id;

      v_kanban_atual := v_kanban_dest;
      v_movido := true;

      INSERT INTO public.kanban_tags (kanban_id, nome, cor)
      VALUES (v_kanban_atual, v_loteamento, '#0C2633')
      ON CONFLICT (kanban_id, nome) DO UPDATE
      SET cor = CASE
        WHEN lower(kanban_tags.cor) IN ('#f5a623', '#ff9800', '#f97316') THEN EXCLUDED.cor
        ELSE kanban_tags.cor
      END;

      SELECT id INTO v_tag_id
      FROM public.kanban_tags
      WHERE kanban_id = v_kanban_atual AND nome = v_loteamento;

      IF v_tag_id IS NOT NULL THEN
        INSERT INTO public.kanban_card_tags (card_id, tag_id)
        VALUES (v_card_id, v_tag_id)
        ON CONFLICT (card_id, tag_id) DO NOTHING;

        DELETE FROM public.kanban_card_tags ct
        USING public.kanban_tags t
        WHERE ct.card_id = v_card_id
          AND ct.tag_id = t.id
          AND t.nome = v_loteamento
          AND t.kanban_id <> v_kanban_atual;
      END IF;
    END IF;

    v_lote_codigo := NULLIF(btrim(COALESCE(p_dados->>'lote_codigo', '')), '');
    v_lote_valor := NULLIF(btrim(COALESCE(p_dados->>'lote_valor', '')), '');
    IF v_lote_codigo IS NOT NULL OR v_lote_valor IS NOT NULL THEN
      UPDATE public.kanban_cards
      SET
        lote = COALESCE(v_lote_codigo, lote),
        vc_lote = COALESCE(v_lote_codigo, vc_lote),
        vc_valor_terreno = COALESCE(v_lote_valor, vc_valor_terreno)
      WHERE id = v_card_id;
    END IF;
  END IF;

  UPDATE public.jornada_cliente_sessao
  SET vcl_card_id = v_card_id
  WHERE session_token = v_token
    AND card_id = p_card_origem;

  RETURN jsonb_build_object(
    'card_id', v_card_id,
    'criado', v_criado,
    'movido', v_movido,
    'corretor_gravado', v_corretor IS NOT NULL OR v_corretor_atual IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.jornada_registrar_lead(text, uuid, text, text, text, uuid, text, boolean, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jornada_registrar_lead(text, uuid, text, text, text, uuid, text, boolean, boolean, jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.jornada_registrar_lead IS
  'Cria ou reaproveita o card VCL pelo telefone (dígitos) e grava tag do loteamento. SECURITY DEFINER — visitante sem login.';

-- ─── Simulação: sempre INSERT, ligada ao card do cliente ────────────────────
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
    RAISE EXCEPTION 'Template não pertence a este empreendimento.';
  END IF;

  v_condicao := COALESCE(NULLIF(btrim(COALESCE(p_payload->>'condicao_lote', '')), ''), 'nao_pago');
  IF v_condicao NOT IN ('nao_pago', 'parcial', 'quitado', 'recurso_proprio') THEN
    v_condicao := 'nao_pago';
  END IF;

  v_itens := COALESCE(p_payload->'customizacao_itens', '[]'::jsonb);
  IF jsonb_typeof(v_itens) IS DISTINCT FROM 'array' THEN
    v_itens := '[]'::jsonb;
  END IF;

  v_inputs := jsonb_strip_nulls(jsonb_build_object(
    'oferta_nome', NULLIF(btrim(COALESCE(p_payload->>'oferta_nome', '')), ''),
    'lote_codigo', NULLIF(btrim(COALESCE(p_payload->>'lote_codigo', '')), ''),
    'lote_rotulo', NULLIF(btrim(COALESCE(p_payload->>'lote_rotulo', '')), ''),
    'slug', NULLIF(btrim(COALESCE(p_payload->>'slug', '')), '')
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
    '{}'::jsonb,
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
  'Grava uma nova simulação da jornada no card VCL do cliente. Sempre INSERT. SECURITY DEFINER.';

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('640', 'jornada_lead_vcl')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('640')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
