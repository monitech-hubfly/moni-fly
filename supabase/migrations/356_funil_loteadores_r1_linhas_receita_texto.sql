-- 356: Funil Loteadores — R1: linhas de receita como texto longo (reverte select da 346).

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_item_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '356: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'r1_conceito_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '356: fase r1_conceito_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'linhas_receita'
  LIMIT 1;

  IF v_item_id IS NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 6, 'Linhas de receita para o loteador', 'texto_longo', false, true, 'linhas_receita', '{}'::jsonb
    );
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens
  SET ordem = 6,
      label = 'Linhas de receita para o loteador',
      tipo = 'texto_longo',
      obrigatorio = false,
      visivel_candidato = true,
      config_json = COALESCE(config_json, '{}'::jsonb) - 'opcoes'
  WHERE id = v_item_id;
END;
$$;
