-- 300: Funil Step One — BCA antes de Batalha das Casas (pre_batalha).
-- Sequência após Lotes: BCA → Batalha das Casas → Escolha → Batalha → Hipóteses.

DO $$
DECLARE
  v_kanban_id UUID;
  v_ordem_lotes INT;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
     OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  ORDER BY CASE WHEN id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '300: kanban Funil Step One não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT MIN(ordem)
  INTO v_ordem_lotes
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('lotes_disponiveis', 'stepone_lotes')
    AND COALESCE(ativo, true) = true;

  IF v_ordem_lotes IS NULL THEN
    RAISE NOTICE '300: fase Lotes Disponíveis não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET ordem = CASE slug
    WHEN 'bca' THEN v_ordem_lotes + 1
    WHEN 'stepone_bca' THEN v_ordem_lotes + 1
    WHEN 'bca_batalha_casas' THEN v_ordem_lotes + 1
    WHEN 'pre_batalha' THEN v_ordem_lotes + 2
    WHEN 'escolha' THEN v_ordem_lotes + 3
    WHEN 'stepone_escolha' THEN v_ordem_lotes + 3
    WHEN 'batalha' THEN v_ordem_lotes + 4
    WHEN 'stepone_batalha' THEN v_ordem_lotes + 4
    WHEN 'hipoteses' THEN v_ordem_lotes + 5
    WHEN 'stepone_hipoteses' THEN v_ordem_lotes + 5
    ELSE ordem
  END
  WHERE kanban_id = v_kanban_id
    AND slug IN (
      'bca',
      'stepone_bca',
      'bca_batalha_casas',
      'pre_batalha',
      'escolha',
      'stepone_escolha',
      'batalha',
      'stepone_batalha',
      'hipoteses',
      'stepone_hipoteses'
    )
    AND COALESCE(ativo, true) = true;
END;
$$;
