-- 351: Funil Loteadores — fase «Comitê»: instruções e checklist simplificado.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_item_id UUID;
  v_instr TEXT := $instr$
Apresentar o projeto para os envolvidos da Casa Moní em Viabilidade de Novos Negócios, colher pareceres e desenhar possibilidades para moldar o negócio.
$instr$;
  v_visiveis TEXT[] := ARRAY['apresentacao_comite', 'pareceres_envolvidos'];
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '351: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'comite_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '351: fase comite_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET instrucoes = v_instr,
      nome = 'Comitê'
  WHERE id = v_fase_id;

  -- 1. Apresentação para Comitê
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'apresentacao_comite'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 1, label = 'Apresentação para Comitê', tipo = 'url', obrigatorio = false,
        visivel_candidato = true, config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 1, 'Apresentação para Comitê', 'url', false, true, 'apresentacao_comite', '{}'::jsonb
    );
  END IF;

  -- 2. Pareceres dos envolvidos
  v_item_id := NULL;
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'pareceres_envolvidos'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 2, label = 'Pareceres dos envolvidos', tipo = 'texto_longo', obrigatorio = false,
        visivel_candidato = true, config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
    WHERE id = v_item_id;
  ELSE
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'conclusao_comite'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 2, label = 'Pareceres dos envolvidos', tipo = 'texto_longo', obrigatorio = false,
          visivel_candidato = true, campo_slug = 'pareceres_envolvidos',
          config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 2, 'Pareceres dos envolvidos', 'texto_longo', false, true, 'pareceres_envolvidos', '{}'::jsonb
      );
    END IF;
  END IF;

  -- Migrar pareceres legados → campo único (se destino vazio)
  INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em)
  SELECT dest.id, agg.card_id, agg.valor, NULL, NULL, NOW()
  FROM (
    SELECT r.card_id,
      NULLIF(
        TRIM(BOTH E'\n' FROM string_agg(
          TRIM(i.label || ': ' || COALESCE(r.valor, '')),
          E'\n' ORDER BY i.ordem
        )),
        ''
      ) AS valor
    FROM public.kanban_fase_checklist_respostas r
    JOIN public.kanban_fase_checklist_itens i ON i.id = r.item_id
    WHERE i.fase_id = v_fase_id
      AND i.campo_slug IN (
        'parecer_comercial', 'parecer_produto', 'parecer_credito',
        'parecer_juridico', 'parecer_operacoes', 'conclusao_comite', 'participantes_comite'
      )
      AND COALESCE(TRIM(r.valor), '') <> ''
    GROUP BY r.card_id
  ) agg
  JOIN public.kanban_fase_checklist_itens dest
    ON dest.fase_id = v_fase_id AND dest.campo_slug = 'pareceres_envolvidos'
  WHERE agg.valor IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_respostas r2
      WHERE r2.item_id = dest.id AND r2.card_id = agg.card_id AND COALESCE(TRIM(r2.valor), '') <> ''
    )
  ON CONFLICT (item_id, card_id) DO NOTHING;

  -- Ocultar extras
  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND (campo_slug IS NULL OR NOT (COALESCE(campo_slug, '') = ANY (v_visiveis)));
END;
$$;
