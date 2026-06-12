-- 349: Funil Loteadores — fase «Execução do Material»: instruções e checklist comercial.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_item_id UUID;
  v_instr TEXT := $instr$
Essa fase deve rodar em paralelo com Acoplamento.

Executar o material comercial com simulações das opções de casa, acoplamentos e materiais visuais para apresentação.
$instr$;
  v_readonly JSONB := '{"readonly":true}'::jsonb;
  v_visiveis TEXT[] := ARRAY[
    'simulacoes_tres_casas',
    'link_acoplamento',
    'materiais_visuais_apresentacao'
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
    RAISE NOTICE '349: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'execucao_material_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '349: fase execucao_material_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET instrucoes = v_instr,
      nome = 'Execução do Material'
  WHERE id = v_fase_id;

  -- 1. Simulações das 3 opções de casa
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'simulacoes_tres_casas'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 1,
        label = 'Simulações das 3 opções de casa',
        tipo = 'url',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui' - 'readonly'
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 1, 'Simulações das 3 opções de casa', 'url', false, true,
      'simulacoes_tres_casas', '{}'::jsonb
    );
  END IF;

  -- 2. Acoplamentos (espelhado da fase Acoplamento)
  v_item_id := NULL;
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'link_acoplamento'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 2,
        label = 'Acoplamentos',
        tipo = 'url',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = v_readonly || '{"sync_from":{"origem":"acoplamento"}}'::jsonb
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 2, 'Acoplamentos', 'url', false, true, 'link_acoplamento',
      v_readonly || '{"sync_from":{"origem":"acoplamento"}}'::jsonb
    );
  END IF;

  -- 3. Link da Apresentação
  v_item_id := NULL;
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'materiais_visuais_apresentacao'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 3,
        label = 'Link da Apresentação',
        tipo = 'url',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui' - 'readonly'
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 3, 'Link da Apresentação', 'url', false, true,
      'materiais_visuais_apresentacao', '{}'::jsonb
    );
  END IF;

  -- Ocultar itens legados
  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND (campo_slug IS NULL OR NOT (COALESCE(campo_slug, '') = ANY (v_visiveis)));
END;
$$;
