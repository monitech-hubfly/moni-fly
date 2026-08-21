-- 485: Tag padrão «Contratar Inst. Garantidor» no Funil Pré Obra e Obra (fases específicas).

DO $$
DECLARE
  v_kanban_id uuid;
  v_tag_id uuid;
BEGIN
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome IN ('Funil Pré Obra e Obra', 'Funil Operações')
    AND COALESCE(ativo, true)
  ORDER BY CASE WHEN nome = 'Funil Pré Obra e Obra' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '485: Funil Pré Obra e Obra não encontrado.';
    RETURN;
  END IF;

  SELECT id INTO v_tag_id
  FROM public.kanban_tags
  WHERE kanban_id = v_kanban_id
    AND nome = 'Contratar Inst. Garantidor'
  LIMIT 1;

  IF v_tag_id IS NULL THEN
    INSERT INTO public.kanban_tags (kanban_id, nome, cor)
    VALUES (v_kanban_id, 'Contratar Inst. Garantidor', '#c24b3a')
    RETURNING id INTO v_tag_id;
  ELSE
    UPDATE public.kanban_tags
    SET cor = '#c24b3a'
    WHERE id = v_tag_id;
  END IF;

  INSERT INTO public.kanban_card_tags (card_id, tag_id)
  SELECT c.id, v_tag_id
  FROM public.kanban_cards c
  JOIN public.kanban_fases f ON f.id = c.fase_id
  WHERE c.kanban_id = v_kanban_id
    AND c.status = 'ativo'
    AND COALESCE(c.arquivado, false) = false
    AND f.slug IN (
      'revisao_bca',
      'aprovacao_prefeitura',
      'aprovacao_condominio',
      'projeto_legal',
      'planialtimetrico'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_card_tags ct
      WHERE ct.card_id = c.id
        AND ct.tag_id = v_tag_id
    );
END $$;

NOTIFY pgrst, 'reload schema';
