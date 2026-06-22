-- 401: Remove fase "Moní Care" do Funil Operações (Pré Obra e Obra).
-- Cards nativos em moni_care → operacoes_entregue (fase sucessora).
-- Legado processo_step_one etapa_painel 'moni_care' → 'operacoes_entregue'.
-- Fase desativada (ativo = false), não deletada — histórico preservado.
-- Campos obra_finalizada / obra_finalizada_em em kanban_cards permanecem (popup desligado no código).

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_moni_care_id UUID;
  v_fase_entregue_id UUID;
  v_moni_care_ordem INT;
  v_cards_movidos INT;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid
     OR (nome = 'Funil Operações' AND COALESCE(ativo, true) = true)
  ORDER BY CASE WHEN id = 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '401: Funil Operações não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id, ordem
  INTO v_fase_moni_care_id, v_moni_care_ordem
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'moni_care'
  LIMIT 1;

  IF v_fase_moni_care_id IS NULL THEN
    RAISE NOTICE '401: fase moni_care não encontrada no Funil Operações; pulando.';
    RETURN;
  END IF;

  SELECT id
  INTO v_fase_entregue_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'operacoes_entregue'
  LIMIT 1;

  -- Checklist da fase Moní Care
  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id
    AND i.fase_id = v_fase_moni_care_id;

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_moni_care_id;

  UPDATE public.kanban_fases
  SET instrucoes = NULL
  WHERE id = v_fase_moni_care_id;

  -- Cards nativos (ativos e arquivados) → operacoes_entregue
  IF v_fase_entregue_id IS NOT NULL THEN
    UPDATE public.kanban_cards c
    SET fase_id = v_fase_entregue_id,
        entered_fase_at = CASE WHEN COALESCE(c.arquivado, false) = false THEN now() ELSE c.entered_fase_at END,
        updated_at = now()
    WHERE c.fase_id = v_fase_moni_care_id;

    GET DIAGNOSTICS v_cards_movidos = ROW_COUNT;
    RAISE NOTICE '401: % card(s) movidos de moni_care → operacoes_entregue.', v_cards_movidos;
  END IF;

  -- Legado processo_step_one (Painel Novos Negócios)
  UPDATE public.processo_step_one p
  SET etapa_painel = 'operacoes_entregue',
      updated_at = now()
  WHERE p.etapa_painel = 'moni_care';

  -- Desativa fase (não deleta)
  UPDATE public.kanban_fases
  SET ativo = false,
      instrucoes = NULL,
      nome = 'Moní Care — removida 401'
  WHERE id = v_fase_moni_care_id
    AND COALESCE(ativo, true) = true;

  -- Renumera fases ativas posteriores (operacoes_entregue passa a ordem 9 se moni_care era 9)
  IF v_moni_care_ordem IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET ordem = ordem - 1
    WHERE kanban_id = v_kanban_id
      AND COALESCE(ativo, true) = true
      AND ordem > v_moni_care_ordem;
  END IF;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('401', 'remove_fase_moni_care_operacoes')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
