-- 350: Funil Loteadores — fase «R2 — Apresentar Plano Teórico»: instruções e checklist.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_item_id UUID;
  v_instr TEXT := $instr$
Apresentar o plano teórico e validar as premissas para contrato de showroom e parceria com o loteador.
$instr$;
  v_visiveis TEXT[] := ARRAY[
    'casa_showroom',
    'concorda_gadgets',
    'forma_pagamento',
    'adendos_observacoes'
  ];
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '350: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'r2_plano_teorico_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '350: fase r2_plano_teorico_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET instrucoes = v_instr,
      nome = 'R2 — Apresentar Plano Teórico'
  WHERE id = v_fase_id;

  -- Showroom: Qual casa será usada?
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'casa_showroom'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 1, label = 'Qual casa será usada?', tipo = 'texto_curto', obrigatorio = false,
        visivel_candidato = true, config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
    WHERE id = v_item_id;
  ELSE
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'casa_sugerida'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 1, label = 'Qual casa será usada?', tipo = 'texto_curto', obrigatorio = false,
          visivel_candidato = true, campo_slug = 'casa_showroom',
          config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 1, 'Qual casa será usada?', 'texto_curto', false, true, 'casa_showroom', '{}'::jsonb
      );
    END IF;
  END IF;

  -- Showroom: gadgets
  v_item_id := NULL;
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'concorda_gadgets'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 2, label = 'O loteador concorda com a lista de gadgets?', tipo = 'texto_curto',
        obrigatorio = false, visivel_candidato = true,
        config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 2, 'O loteador concorda com a lista de gadgets?', 'texto_curto', false, true,
      'concorda_gadgets', '{}'::jsonb
    );
  END IF;

  -- Showroom: forma de pagamento
  v_item_id := NULL;
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'forma_pagamento'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 3, label = 'Forma de pagamento', tipo = 'texto_curto', obrigatorio = false,
        visivel_candidato = true, config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 3, 'Forma de pagamento', 'texto_curto', false, true, 'forma_pagamento', '{}'::jsonb
    );
  END IF;

  -- Parceria: adendos
  v_item_id := NULL;
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'adendos_observacoes'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 4, label = 'Adendos / observações', tipo = 'texto_longo', obrigatorio = false,
        visivel_candidato = true, config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
    WHERE id = v_item_id;
  ELSE
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'comentarios_finais'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 4, label = 'Adendos / observações', tipo = 'texto_longo', obrigatorio = false,
          visivel_candidato = true, campo_slug = 'adendos_observacoes',
          config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 4, 'Adendos / observações', 'texto_longo', false, true, 'adendos_observacoes', '{}'::jsonb
      );
    END IF;
  END IF;

  -- Ocultar extras
  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND (campo_slug IS NULL OR NOT (COALESCE(campo_slug, '') = ANY (v_visiveis)));
END;
$$;
