-- 348: Funil Loteadores — fase «Acoplamento»: instruções e checklist espelhado (Viabilidade + esteira).

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_item_id UUID;
  v_instr TEXT := $instr$
Enviar necessidade para o Time de Acoplamento.
$instr$;
  v_readonly JSONB := '{"readonly":true}'::jsonb;
  v_visiveis TEXT[] := ARRAY[
    'lote_showroom_quadra',
    'lote_showroom',
    'planta_cadastral_lote',
    'fotos_lote',
    'videos_lote',
    'casas_simulacao',
    'manual_obra',
    'gadgets',
    'link_acoplamento',
    'link_gbox'
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
    RAISE NOTICE '348: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'acoplamento_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '348: fase acoplamento_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET instrucoes = v_instr,
      nome = 'Acoplamento'
  WHERE id = v_fase_id;

  -- 1. Quadra (Viabilidade)
  SELECT id INTO v_item_id FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'lote_showroom_quadra' LIMIT 1;
  IF v_item_id IS NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 1, 'Lote escolhido para showroom — Quadra', 'numero', false, true,
      'lote_showroom_quadra', v_readonly || '{"decimal":true,"step":"any","sync_from":{"origem":"viabilidade"}}'::jsonb
    );
  ELSE
    UPDATE public.kanban_fase_checklist_itens SET
      ordem = 1, label = 'Lote escolhido para showroom — Quadra', tipo = 'numero',
      config_json = v_readonly || '{"decimal":true,"step":"any","sync_from":{"origem":"viabilidade"}}'::jsonb
    WHERE id = v_item_id;
  END IF;

  -- 2. Lote (Viabilidade)
  v_item_id := NULL;
  SELECT id INTO v_item_id FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'lote_showroom' LIMIT 1;
  IF v_item_id IS NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 2, 'Lote escolhido para showroom — Lote', 'numero', false, true,
      'lote_showroom', v_readonly || '{"decimal":true,"step":"any","sync_from":{"origem":"viabilidade"}}'::jsonb
    );
  ELSE
    UPDATE public.kanban_fase_checklist_itens SET
      ordem = 2, label = 'Lote escolhido para showroom — Lote', tipo = 'numero',
      config_json = v_readonly || '{"decimal":true,"step":"any","sync_from":{"origem":"viabilidade"}}'::jsonb
    WHERE id = v_item_id;
  END IF;

  -- 3. Planta cadastral
  v_item_id := NULL;
  SELECT id INTO v_item_id FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'planta_cadastral_lote' LIMIT 1;
  IF v_item_id IS NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 3, 'Planta cadastral com medidas do lote e topografia', 'anexo', false, true,
      'planta_cadastral_lote', v_readonly || '{"sync_from":{"origem":"viabilidade"}}'::jsonb
    );
  ELSE
    UPDATE public.kanban_fase_checklist_itens SET
      ordem = 3, label = 'Planta cadastral com medidas do lote e topografia', tipo = 'anexo',
      config_json = v_readonly || '{"sync_from":{"origem":"viabilidade"}}'::jsonb
    WHERE id = v_item_id;
  END IF;

  -- 4. Fotos
  v_item_id := NULL;
  SELECT id INTO v_item_id FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'fotos_lote' LIMIT 1;
  IF v_item_id IS NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 4, 'Fotos do lote escolhido', 'anexo_multiplo', false, true,
      'fotos_lote', v_readonly || '{"sync_from":{"origem":"viabilidade"}}'::jsonb
    );
  ELSE
    UPDATE public.kanban_fase_checklist_itens SET
      ordem = 4, label = 'Fotos do lote escolhido', tipo = 'anexo_multiplo',
      config_json = v_readonly || '{"sync_from":{"origem":"viabilidade"}}'::jsonb
    WHERE id = v_item_id;
  END IF;

  -- 5. Vídeos
  v_item_id := NULL;
  SELECT id INTO v_item_id FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'videos_lote' LIMIT 1;
  IF v_item_id IS NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 5, 'Vídeos do lote escolhido', 'anexo_multiplo', false, true,
      'videos_lote', v_readonly || '{"sync_from":{"origem":"viabilidade"}}'::jsonb
    );
  ELSE
    UPDATE public.kanban_fase_checklist_itens SET
      ordem = 5, label = 'Vídeos do lote escolhido', tipo = 'anexo_multiplo',
      config_json = v_readonly || '{"sync_from":{"origem":"viabilidade"}}'::jsonb
    WHERE id = v_item_id;
  END IF;

  -- 6. Casas simulação
  v_item_id := NULL;
  SELECT id INTO v_item_id FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'casas_simulacao' LIMIT 1;
  IF v_item_id IS NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 6, 'Escolher 3 casas', 'texto_longo', false, true,
      'casas_simulacao', v_readonly || '{"sync_from":{"origem":"viabilidade"}}'::jsonb
    );
  ELSE
    UPDATE public.kanban_fase_checklist_itens SET
      ordem = 6, label = 'Escolher 3 casas', tipo = 'texto_longo',
      config_json = v_readonly || '{"sync_from":{"origem":"viabilidade"}}'::jsonb
    WHERE id = v_item_id;
  END IF;

  -- 7. Manual de Obra
  v_item_id := NULL;
  SELECT id INTO v_item_id FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'manual_obra' LIMIT 1;
  IF v_item_id IS NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 7, 'Manual de Obra', 'anexo', false, true,
      'manual_obra', v_readonly || '{"sync_from":{"origem":"viabilidade"}}'::jsonb
    );
  ELSE
    UPDATE public.kanban_fase_checklist_itens SET
      ordem = 7, label = 'Manual de Obra', tipo = 'anexo',
      config_json = v_readonly || '{"sync_from":{"origem":"viabilidade"}}'::jsonb
    WHERE id = v_item_id;
  END IF;

  -- 8. Gadgets
  v_item_id := NULL;
  SELECT id INTO v_item_id FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'gadgets' LIMIT 1;
  IF v_item_id IS NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 8, 'Gadgets', 'texto_longo', false, true,
      'gadgets', v_readonly || '{"sync_from":{"origem":"viabilidade"}}'::jsonb
    );
  ELSE
    UPDATE public.kanban_fase_checklist_itens SET
      ordem = 8, label = 'Gadgets', tipo = 'texto_longo',
      config_json = v_readonly || '{"sync_from":{"origem":"viabilidade"}}'::jsonb
    WHERE id = v_item_id;
  END IF;

  -- 9. Acoplamento (esteira)
  v_item_id := NULL;
  SELECT id INTO v_item_id FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'link_acoplamento' LIMIT 1;
  IF v_item_id IS NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 9, 'Acoplamento', 'url', false, true,
      'link_acoplamento', v_readonly || '{"sync_from":{"origem":"esteira_acoplamento"}}'::jsonb
    );
  ELSE
    UPDATE public.kanban_fase_checklist_itens SET
      ordem = 9, label = 'Acoplamento', tipo = 'url',
      config_json = v_readonly || '{"sync_from":{"origem":"esteira_acoplamento"}}'::jsonb
    WHERE id = v_item_id;
  END IF;

  -- 10. GBox (esteira)
  v_item_id := NULL;
  SELECT id INTO v_item_id FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'link_gbox' LIMIT 1;
  IF v_item_id IS NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 10, 'GBox', 'url', false, true,
      'link_gbox', v_readonly || '{"sync_from":{"origem":"esteira_acoplamento"}}'::jsonb
    );
  ELSE
    UPDATE public.kanban_fase_checklist_itens SET
      ordem = 10, label = 'GBox', tipo = 'url',
      config_json = v_readonly || '{"sync_from":{"origem":"esteira_acoplamento"}}'::jsonb
    WHERE id = v_item_id;
  END IF;

  -- Ocultar extras (status, observações, etc.)
  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND (campo_slug IS NULL OR NOT (COALESCE(campo_slug, '') = ANY (v_visiveis)));
END;
$$;
