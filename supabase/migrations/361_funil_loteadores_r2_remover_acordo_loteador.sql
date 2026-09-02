-- 361: Funil Loteadores — R2 Plano Teórico: ocultar acordo loteador e legados.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_visiveis TEXT[] := ARRAY[
    'casa_showroom',
    'concorda_gadgets',
    'forma_pagamento',
    'adendos_observacoes'
  ];
  v_removidos_slug TEXT[] := ARRAY[
    'loteador_de_acordo',
    'motivo_nao_acordo',
    'ajustes_solicitados',
    'comentarios_finais',
    'proximos_passos',
    'casa_sugerida'
  ];
  v_removidos_label TEXT[] := ARRAY[
    'Loteador está de acordo?',
    'Loteador de acordo',
    'Se não, por quê?',
    'Ajustes solicitados',
    'Comentários finais',
    'Próximos passos'
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
    RAISE NOTICE '361: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'r2_plano_teorico_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '361: fase r2_plano_teorico_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui',
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND COALESCE(campo_slug, '') = ANY (v_visiveis);

  UPDATE public.kanban_fase_checklist_itens
  SET ordem = 4,
      config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui' - 'visible_when'
  WHERE fase_id = v_fase_id
    AND campo_slug = 'adendos_observacoes';

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
        'Qual casa será usada?',
        'O loteador concorda com a lista de gadgets?',
        'Concorda com gadgets',
        'Forma de pagamento',
        'Adendos / observações'
      )
    );
END;
$$;
