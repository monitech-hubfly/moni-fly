-- 365: Funil Loteadores — Contrato: ocultar campos legados.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_visiveis TEXT[] := ARRAY['contrato_assinado'];
  v_removidos_slug TEXT[] := ARRAY[
    'contrato_enviado',
    'data_assinatura',
    'cnpj_contratante',
    'contrato_anexado',
    'documentos_complementares'
  ];
  v_removidos_label TEXT[] := ARRAY[
    'Contrato enviado',
    'Data assinatura',
    'CNPJ contratante',
    'Contrato anexado',
    'Documentos complementares'
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
    RAISE NOTICE '365: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'fechar_contrato_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '365: fase fechar_contrato_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens
  SET label = 'Contrato assinado',
      tipo = 'anexo',
      config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui',
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND campo_slug = 'contrato_assinado';

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
    AND TRIM(label) <> 'Contrato assinado';
END;
$$;
