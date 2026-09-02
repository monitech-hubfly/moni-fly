-- 398: Remove fase "Sondagem (paralelo Planialtimétrico)" do Funil Operações (Pré Obra e Obra).
-- Cards nativos em sondagem → planialtimetrico (fase paralela adjacente).
-- Legado processo_step_one etapa_painel 'sondagem' → 'planialtimetrico'.
-- Fase desativada (ativo = false), não deletada — histórico e augment de cards órfãos preservados.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_sondagem_id UUID;
  v_fase_planialtimetrico_id UUID;
  v_sondagem_ordem INT;
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
    RAISE NOTICE '398: Funil Operações não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id, ordem
  INTO v_fase_sondagem_id, v_sondagem_ordem
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'sondagem'
  LIMIT 1;

  IF v_fase_sondagem_id IS NULL THEN
    RAISE NOTICE '398: fase sondagem não encontrada no Funil Operações; pulando.';
    RETURN;
  END IF;

  SELECT id
  INTO v_fase_planialtimetrico_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'planialtimetrico'
  LIMIT 1;

  -- Checklist da fase Sondagem
  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id
    AND i.fase_id = v_fase_sondagem_id;

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_sondagem_id;

  UPDATE public.kanban_fases
  SET instrucoes = NULL
  WHERE id = v_fase_sondagem_id;

  -- Cards nativos → planialtimetrico
  IF v_fase_planialtimetrico_id IS NOT NULL THEN
    UPDATE public.kanban_cards c
    SET fase_id = v_fase_planialtimetrico_id,
        updated_at = now()
    WHERE c.fase_id = v_fase_sondagem_id;

    GET DIAGNOSTICS v_cards_movidos = ROW_COUNT;
    RAISE NOTICE '398: % card(s) movidos de sondagem → planialtimetrico.', v_cards_movidos;
  END IF;

  -- Legado processo_step_one (Painel Novos Negócios)
  UPDATE public.processo_step_one p
  SET etapa_painel = 'planialtimetrico',
      updated_at = now()
  WHERE p.etapa_painel = 'sondagem';

  -- Desativa fase (não deleta)
  UPDATE public.kanban_fases
  SET ativo = false,
      instrucoes = NULL,
      nome = 'Sondagem (paralelo Planialtimétrico — removida 398)'
  WHERE id = v_fase_sondagem_id
    AND COALESCE(ativo, true) = true;

  -- Renumera fases ativas posteriores
  IF v_sondagem_ordem IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET ordem = ordem - 1
    WHERE kanban_id = v_kanban_id
      AND COALESCE(ativo, true) = true
      AND ordem > v_sondagem_ordem;
  END IF;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('398', 'funil_operacoes_remove_fase_sondagem')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
