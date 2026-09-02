-- 342: Funil Loteadores — correção se migration 338 antiga criou viabilidade duplicada.
-- Seguro reexecutar: não move cards; só inativa viabilidade_moni_inc VAZIA quando dados_loteador tem cards.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_dados UUID;
  v_fase_viab UUID;
  v_cards_dados INT;
  v_cards_viab INT;
BEGIN
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_fase_dados FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'dados_loteador_moni_inc' LIMIT 1;

  SELECT id INTO v_fase_viab FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'viabilidade_moni_inc' LIMIT 1;

  IF v_fase_dados IS NULL OR v_fase_viab IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_cards_dados FROM public.kanban_cards WHERE kanban_id = v_kanban_id AND fase_id = v_fase_dados;
  SELECT COUNT(*) INTO v_cards_viab FROM public.kanban_cards WHERE kanban_id = v_kanban_id AND fase_id = v_fase_viab;

  IF v_cards_viab = 0 AND v_cards_dados > 0 THEN
    UPDATE public.kanban_fases
    SET nome = 'Viabilidade', ordem = 3, ativo = true
    WHERE id = v_fase_dados;

    UPDATE public.kanban_fases
    SET ativo = false, ordem = 98, nome = 'Viabilidade (duplicata vazia — legado 338)'
    WHERE id = v_fase_viab;

    RAISE NOTICE '342: viabilidade_moni_inc vazia inativada; cards permanecem em dados_loteador_moni_inc (renomeada Viabilidade).';
  ELSIF v_cards_viab > 0 AND v_cards_dados > 0 THEN
    RAISE NOTICE '342: ambas fases com cards (dados=%, viab=%). Nenhuma alteração — validar manualmente.', v_cards_dados, v_cards_viab;
  END IF;
END;
$$;
