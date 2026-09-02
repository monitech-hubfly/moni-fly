-- 345: Funil Loteadores — fase «R1 Executada — Conceito»: instruções e checklist (somente campos da spec).

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_item_id UUID;
  v_instr TEXT := $instr$
Apresentar as premissas do negócio e demonstrar ao loteador que ele pode:

• Lucrar com a carteira já vendida
• Fazer antecipação de recebíveis
• Aumentar o funil de leads
• Gerar valor para o empreendimento por meio de casas/showroom
$instr$;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '345: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'r1_conceito_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '345: fase r1_conceito_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET instrucoes = v_instr,
      nome = 'R1 Executada — Conceito'
  WHERE id = v_fase_id;

  -- 1. Interesse do loteador (nota automática)
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'interesse_loteador'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 1,
        label = 'Interesse do loteador',
        tipo = 'calculado',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = '{"formula":"loteadores_r1_interesse","min":0,"max":100}'::jsonb
    WHERE id = v_item_id;
  ELSE
    -- Reaproveita score legado se existir
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'score_loteador'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 1,
          label = 'Interesse do loteador',
          tipo = 'calculado',
          obrigatorio = false,
          visivel_candidato = true,
          campo_slug = 'interesse_loteador',
          config_json = '{"formula":"loteadores_r1_interesse","min":0,"max":100}'::jsonb
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 1, 'Interesse do loteador', 'calculado', false, true, 'interesse_loteador',
        '{"formula":"loteadores_r1_interesse","min":0,"max":100}'::jsonb
      );
    END IF;
  END IF;

  -- 2. Preço
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'preco_atratividade'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 2,
        label = 'Preço',
        tipo = 'select',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = '{"opcoes":["Atrativo","Não atrativo","Não expôs"]}'::jsonb
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 2, 'Preço', 'select', false, true, 'preco_atratividade',
      '{"opcoes":["Atrativo","Não atrativo","Não expôs"]}'::jsonb
    );
  END IF;

  -- 3. Produto
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'produto_atratividade'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 3,
        label = 'Produto',
        tipo = 'select',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = '{"opcoes":["Atrativo","Não atrativo","Não expôs","Algumas alterações"]}'::jsonb
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 3, 'Produto', 'select', false, true, 'produto_atratividade',
      '{"opcoes":["Atrativo","Não atrativo","Não expôs","Algumas alterações"]}'::jsonb
    );
  END IF;

  -- 4. Previsão de showroom
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'showroom_interesse'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 4,
        label = 'Previsão de showroom',
        tipo = 'select',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = '{"opcoes":["Sim","Não","Não expôs"]}'::jsonb
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 4, 'Previsão de showroom', 'select', false, true, 'showroom_interesse',
      '{"opcoes":["Sim","Não","Não expôs"]}'::jsonb
    );
  END IF;

  -- 5. Se sim, qual?
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'showroom_descricao'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 5,
        label = 'Se sim, qual?',
        tipo = 'texto_longo',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = '{"visible_when":{"campo_slug":"showroom_interesse","valor":"Sim"}}'::jsonb
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 5, 'Se sim, qual?', 'texto_longo', false, true, 'showroom_descricao',
      '{"visible_when":{"campo_slug":"showroom_interesse","valor":"Sim"}}'::jsonb
    );
  END IF;

  -- 6. Linhas de receita para o loteador
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'linhas_receita'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 6,
        label = 'Linhas de receita para o loteador',
        tipo = 'texto_longo',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = '{}'::jsonb
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 6, 'Linhas de receita para o loteador', 'texto_longo', false, true, 'linhas_receita', '{}'::jsonb
    );
  END IF;

  -- 7. Como é a casa que vende lá?
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'casa_que_vende'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 7,
        label = 'Como é a casa que vende lá?',
        tipo = 'texto_longo',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = '{}'::jsonb
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 7, 'Como é a casa que vende lá?', 'texto_longo', false, true, 'casa_que_vende', '{}'::jsonb
    );
  END IF;

  -- Ocultar itens extras (preserva respostas)
  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND COALESCE(campo_slug, '') NOT IN (
      'interesse_loteador',
      'preco_atratividade',
      'produto_atratividade',
      'showroom_interesse',
      'showroom_descricao',
      'linhas_receita',
      'casa_que_vende'
    );

  -- Migrar respostas score/classificação → interesse_loteador
  INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em)
  SELECT dest.id, src.card_id, src.valor, src.arquivo_path, src.preenchido_por, src.preenchido_em
  FROM public.kanban_fase_checklist_respostas src
  JOIN public.kanban_fase_checklist_itens orig ON orig.id = src.item_id
  JOIN public.kanban_fase_checklist_itens dest
    ON dest.fase_id = v_fase_id
   AND dest.campo_slug = 'interesse_loteador'
  WHERE orig.fase_id = v_fase_id
    AND orig.campo_slug = 'score_loteador'
    AND COALESCE(TRIM(src.valor), '') <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_respostas r2
      WHERE r2.item_id = dest.id AND r2.card_id = src.card_id AND COALESCE(TRIM(r2.valor), '') <> ''
    )
  ON CONFLICT (item_id, card_id) DO NOTHING;
END;
$$;
