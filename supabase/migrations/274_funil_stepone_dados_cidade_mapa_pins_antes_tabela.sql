-- 274: Garante ordem — Mapa da Cidade (pins) antes da Tabela de Condomínios.

DO $$
DECLARE
  v_fase_id UUID;
  v_label_mapa CONSTANT TEXT :=
    'Mapa da Cidade (cole o mapa com os condomínios demarcados por Pins)';
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('dados_cidade', 'stepone_dados_cidade')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'dados_cidade' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '274: fase dados_cidade não encontrada; pulando.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 5, 'Breve descrição da Cidade', 'texto_longo', true, true,
    $ph$Descreva as regiões mais valorizadas e a quantidade estimada de condomínios com casas acima de R$ 12.000/m² adequados para operação Moní.$ph$
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id AND i.label = 'Breve descrição da Cidade'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
  SELECT v_fase_id, 6, v_label_mapa, 'anexo', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id
      AND (i.label = v_label_mapa OR i.label ILIKE 'Mapa da Cidade (cole o mapa%')
  );

  UPDATE public.kanban_fase_checklist_itens
  SET label = v_label_mapa
  WHERE fase_id = v_fase_id
    AND label ILIKE 'Mapa da Cidade (cole o mapa com os condominios demarcados por Pins%'
    AND label <> v_label_mapa
    AND NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens i2
      WHERE i2.fase_id = v_fase_id AND i2.label = v_label_mapa AND i2.id <> kanban_fase_checklist_itens.id
    );

  UPDATE public.kanban_fase_checklist_itens SET ordem = 1
  WHERE fase_id = v_fase_id AND label = 'Cidade de interesse';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 2
  WHERE fase_id = v_fase_id AND label = 'Estado';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 3
  WHERE fase_id = v_fase_id AND label = 'Dados da cidade (IBGE)';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 4
  WHERE fase_id = v_fase_id AND label = 'Mapa interativo da praça';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 5
  WHERE fase_id = v_fase_id AND label = 'Breve descrição da Cidade';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 6
  WHERE fase_id = v_fase_id
    AND (label = v_label_mapa OR label ILIKE 'Mapa da Cidade (cole o mapa%');

  UPDATE public.kanban_fase_checklist_itens SET ordem = 7
  WHERE fase_id = v_fase_id AND label = 'Tabela de Condomínios';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 8
  WHERE fase_id = v_fase_id AND label = 'Observações sobre a praça';
END;
$$;
