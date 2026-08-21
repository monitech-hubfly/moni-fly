-- 295: Funil Step One — Mapa de Competidores antes de Lotes Disponíveis (ordem 4 e 5).

DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
     OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  ORDER BY CASE WHEN id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '295: kanban Funil Step One não encontrado; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET ordem = CASE slug
    WHEN 'mapa_competidores' THEN 4
    WHEN 'stepone_mapa' THEN 4
    WHEN 'lotes_disponiveis' THEN 5
    WHEN 'stepone_lotes' THEN 5
    ELSE ordem
  END
  WHERE kanban_id = v_kanban_id
    AND slug IN ('mapa_competidores', 'stepone_mapa', 'lotes_disponiveis', 'stepone_lotes')
    AND COALESCE(ativo, true) = true;
END;
$$;
