-- 515: Funil Loteadores — mover cards de fases a desativar + inativar fases.
-- Premissa: nenhum card é deletado; fases de origem ficam com ativo = false.
-- Coluna correta em kanban_cards: fase_id (FK), não fase_slug.
-- Idempotente. DO $$ = uma transação.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  v_from UUID;
  v_to UUID;
  v_moved INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    RAISE NOTICE '515: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  -- batalha_casas_moni_inc → execucao_material_moni_inc
  SELECT id INTO v_from FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'batalha_casas_moni_inc' LIMIT 1;
  SELECT id INTO v_to FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'execucao_material_moni_inc' LIMIT 1;
  IF v_from IS NOT NULL AND v_to IS NOT NULL THEN
    UPDATE public.kanban_cards
    SET fase_id = v_to, entered_fase_at = COALESCE(entered_fase_at, now())
    WHERE kanban_id = v_kanban_id AND fase_id = v_from;
    GET DIAGNOSTICS v_moved = ROW_COUNT;
    RAISE NOTICE '515: batalha_casas → execucao_material: % card(s)', v_moved;
  ELSE
    RAISE NOTICE '515: batalha_casas → execucao_material: fase origem/destino ausente — pulando move';
  END IF;

  -- r3_ajustes_finais_moni_inc → revisoes_moni_inc
  SELECT id INTO v_from FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'r3_ajustes_finais_moni_inc' LIMIT 1;
  SELECT id INTO v_to FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_moni_inc' LIMIT 1;
  IF v_from IS NOT NULL AND v_to IS NOT NULL THEN
    UPDATE public.kanban_cards
    SET fase_id = v_to, entered_fase_at = COALESCE(entered_fase_at, now())
    WHERE kanban_id = v_kanban_id AND fase_id = v_from;
    GET DIAGNOSTICS v_moved = ROW_COUNT;
    RAISE NOTICE '515: r3_ajustes_finais → revisoes: % card(s)', v_moved;
  ELSE
    RAISE NOTICE '515: r3_ajustes_finais → revisoes: fase origem/destino ausente — pulando move';
  END IF;

  -- moni_capital_moni_inc → revisoes_moni_inc
  SELECT id INTO v_from FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'moni_capital_moni_inc' LIMIT 1;
  SELECT id INTO v_to FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_moni_inc' LIMIT 1;
  IF v_from IS NOT NULL AND v_to IS NOT NULL THEN
    UPDATE public.kanban_cards
    SET fase_id = v_to, entered_fase_at = COALESCE(entered_fase_at, now())
    WHERE kanban_id = v_kanban_id AND fase_id = v_from;
    GET DIAGNOSTICS v_moved = ROW_COUNT;
    RAISE NOTICE '515: moni_capital → revisoes: % card(s)', v_moved;
  ELSE
    RAISE NOTICE '515: moni_capital → revisoes: fase origem/destino ausente — pulando move';
  END IF;

  -- abertura_spe_moni_inc → fechar_contrato_moni_inc
  -- (fallback cto_showroom_moni_inc se o slug já tiver sido renomeado em migration posterior)
  SELECT id INTO v_from FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'abertura_spe_moni_inc' LIMIT 1;
  SELECT id INTO v_to FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'fechar_contrato_moni_inc' LIMIT 1;
  IF v_to IS NULL THEN
    SELECT id INTO v_to FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'cto_showroom_moni_inc' LIMIT 1;
  END IF;
  IF v_from IS NOT NULL AND v_to IS NOT NULL THEN
    UPDATE public.kanban_cards
    SET fase_id = v_to, entered_fase_at = COALESCE(entered_fase_at, now())
    WHERE kanban_id = v_kanban_id AND fase_id = v_from;
    GET DIAGNOSTICS v_moved = ROW_COUNT;
    RAISE NOTICE '515: abertura_spe → contrato/showroom: % card(s)', v_moved;
  ELSE
    RAISE NOTICE '515: abertura_spe → fechar_contrato: fase origem/destino ausente — pulando move';
  END IF;

  -- Desativar fases de origem (não DELETE)
  UPDATE public.kanban_fases
  SET ativo = false
  WHERE kanban_id = v_kanban_id
    AND slug IN (
      'batalha_casas_moni_inc',
      'r3_ajustes_finais_moni_inc',
      'moni_capital_moni_inc',
      'abertura_spe_moni_inc'
    );

  RAISE NOTICE '515: cards movidos e fases de origem desativadas.';
END $$;
