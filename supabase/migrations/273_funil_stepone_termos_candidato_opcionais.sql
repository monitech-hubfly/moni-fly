-- 273: Funil Step One — Dados do Candidato: termos opcionais + templates para download.

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
    RAISE NOTICE '273: fase dados_candidato não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens
  SET
    obrigatorio = false,
    template_storage_path = 'static:/templates/stepone-candidato/termo-confidencialidade.docx'
  WHERE fase_id = v_fase_id
    AND label = 'Termo de Confidencialidade e Não-Divulgação';

  UPDATE public.kanban_fase_checklist_itens
  SET
    obrigatorio = false,
    template_storage_path = 'static:/templates/stepone-candidato/termo-autorizacao-consulta.docx'
  WHERE fase_id = v_fase_id
    AND label = 'Termo de Autorização para Consulta de Informações';
END;
$$;
