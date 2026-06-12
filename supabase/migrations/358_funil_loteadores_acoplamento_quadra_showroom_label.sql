-- 358: Funil Loteadores — renomear label quadra showroom (Acoplamento).

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '358: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'acoplamento_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '358: fase acoplamento_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens
  SET label = 'Quadra escolhida para showroom — Quadra'
  WHERE fase_id = v_fase_id
    AND campo_slug = 'lote_showroom_quadra';

  -- Legado: mesmo label sem slug canônico
  UPDATE public.kanban_fase_checklist_itens
  SET label = 'Quadra escolhida para showroom — Quadra'
  WHERE fase_id = v_fase_id
    AND TRIM(label) = 'Lote escolhido para showroom — Quadra';
END;
$$;
