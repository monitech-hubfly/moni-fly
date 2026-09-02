-- 346: Funil Loteadores — R1: linhas de receita como select (score categórico).

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

  IF v_kanban_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'r1_conceito_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'linhas_receita'
  LIMIT 1;

  IF v_item_id IS NULL THEN RETURN; END IF;

  UPDATE public.kanban_fase_checklist_itens
  SET ordem = 6,
      label = 'Linhas de receita para o loteador',
      tipo = 'select',
      obrigatorio = false,
      visivel_candidato = true,
      config_json = '{"opcoes":["Identificou oportunidades","Poucas oportunidades","Nenhuma oportunidade"]}'::jsonb
  WHERE id = v_item_id;

  -- Texto livre legado → melhor palpite para score (20 pts)
  UPDATE public.kanban_fase_checklist_respostas r
  SET valor = 'Identificou oportunidades'
  WHERE r.item_id = v_item_id
    AND COALESCE(TRIM(r.valor), '') <> ''
    AND TRIM(r.valor) NOT IN (
      'Identificou oportunidades',
      'Poucas oportunidades',
      'Nenhuma oportunidade'
    );
END;
$$;
