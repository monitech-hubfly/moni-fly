-- 375: Funil Step One — Dados do Candidato: Profissão e textos longos opcionais (reforço da 374).

DO $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('dados_candidato', 'stepone_dados_candidato')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'dados_candidato' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '375: fase dados_candidato não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens
  SET obrigatorio = false
  WHERE fase_id = v_fase_id
    AND ordem IN (5, 6, 7, 8);

  UPDATE public.kanban_fase_checklist_itens
  SET obrigatorio = false
  WHERE fase_id = v_fase_id
    AND (
      label ILIKE 'Profiss%'
      OR label ILIKE '%Experi%ncias profissionais%'
      OR label ILIKE '%Trajet%ria e aprendizados%'
      OR label ILIKE '%bom franqueado Mon%'
    );
END;
$$;
