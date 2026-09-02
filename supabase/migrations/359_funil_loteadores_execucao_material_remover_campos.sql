-- 359: Funil Loteadores — Execução do Material: ocultar simulações por casa (legado).

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_visiveis TEXT[] := ARRAY[
    'simulacoes_tres_casas',
    'link_acoplamento',
    'materiais_visuais_apresentacao'
  ];
  v_removidos_slug TEXT[] := ARRAY[
    'simulacao_casa_1',
    'simulacao_casa_2',
    'simulacao_casa_3',
    'oferta_showroom',
    'material_comercial',
    'material_institucional',
    'status_material'
  ];
  v_removidos_label TEXT[] := ARRAY[
    'Simulação casa 1',
    'Simulação casa 2',
    'Simulação casa 3',
    'Oferta showroom',
    'Material comercial',
    'Material institucional',
    'Status material'
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
    RAISE NOTICE '359: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'execucao_material_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '359: fase execucao_material_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui',
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND COALESCE(campo_slug, '') = ANY (v_visiveis);

  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND (
      COALESCE(campo_slug, '') = ANY (v_removidos_slug)
      OR TRIM(label) = ANY (v_removidos_label)
    );

  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND NOT (COALESCE(campo_slug, '') = ANY (v_visiveis))
    AND NOT (
      TRIM(label) IN (
        'Simulações das 3 opções de casa',
        'Acoplamentos',
        'Link da Apresentação',
        'Materiais visuais para apresentação'
      )
    );
END;
$$;
