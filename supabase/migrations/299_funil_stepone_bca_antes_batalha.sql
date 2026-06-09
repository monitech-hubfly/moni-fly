-- 299: Funil Step One — BCA antes de Batalha (ordem 8 e 9).

DO $$
DECLARE
  v_kanban_id UUID;
  v_ordem_bca INT;
  v_ordem_batalha INT;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
     OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  ORDER BY CASE WHEN id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '299: kanban Funil Step One não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT MIN(ordem)
  INTO v_ordem_bca
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('bca', 'stepone_bca', 'bca_batalha_casas')
    AND COALESCE(ativo, true) = true;

  SELECT MIN(ordem)
  INTO v_ordem_batalha
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('batalha', 'stepone_batalha')
    AND COALESCE(ativo, true) = true;

  IF v_ordem_bca IS NULL OR v_ordem_batalha IS NULL THEN
    RAISE NOTICE '299: fases BCA ou Batalha não encontradas; pulando.';
    RETURN;
  END IF;

  IF v_ordem_batalha < v_ordem_bca THEN
    UPDATE public.kanban_fases
    SET ordem = CASE slug
      WHEN 'bca' THEN v_ordem_batalha
      WHEN 'stepone_bca' THEN v_ordem_batalha
      WHEN 'bca_batalha_casas' THEN v_ordem_batalha
      WHEN 'batalha' THEN v_ordem_bca
      WHEN 'stepone_batalha' THEN v_ordem_bca
      ELSE ordem
    END
    WHERE kanban_id = v_kanban_id
      AND slug IN ('bca', 'stepone_bca', 'bca_batalha_casas', 'batalha', 'stepone_batalha')
      AND COALESCE(ativo, true) = true;
  ELSE
    UPDATE public.kanban_fases
    SET ordem = CASE slug
      WHEN 'bca' THEN 8
      WHEN 'stepone_bca' THEN 8
      WHEN 'bca_batalha_casas' THEN 8
      WHEN 'batalha' THEN 9
      WHEN 'stepone_batalha' THEN 9
      ELSE ordem
    END
    WHERE kanban_id = v_kanban_id
      AND slug IN ('bca', 'stepone_bca', 'bca_batalha_casas', 'batalha', 'stepone_batalha')
      AND COALESCE(ativo, true) = true;
  END IF;
END;
$$;
