-- 355: Funil Loteadores — Primeiro Contato: ocultar campos legados removidos da spec.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_visiveis TEXT[] := ARRAY[
    'como_foi_primeiro_contato',
    'data_reuniao',
    'horario_reuniao'
  ];
  v_removidos_slug TEXT[] := ARRAY[
    'primeiro_contato_descricao',
    'responsavel_contato',
    'canal_contato',
    'participantes_previstos',
    'observacoes_reuniao'
  ];
  v_removidos_label TEXT[] := ARRAY[
    'Descrição do primeiro contato',
    'Responsável pelo contato',
    'Canal de contato',
    'Participantes previstos',
    'Observações da reunião'
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
    RAISE NOTICE '355: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'primeiro_contato_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '355: fase primeiro_contato_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  -- Garantir visíveis sem oculto_ui
  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui',
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND COALESCE(campo_slug, '') = ANY (v_visiveis);

  -- Ocultar campos removidos (por slug ou label legado)
  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND (
      COALESCE(campo_slug, '') = ANY (v_removidos_slug)
      OR TRIM(label) = ANY (v_removidos_label)
    );

  -- Demais extras (fora dos 3 canônicos)
  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND NOT (COALESCE(campo_slug, '') = ANY (v_visiveis))
    AND NOT (TRIM(label) = ANY (ARRAY['Como foi o primeiro contato?', 'Data da Reunião', 'Data da reunião', 'Horário da Reunião', 'Horário da reunião']));
END;
$$;
