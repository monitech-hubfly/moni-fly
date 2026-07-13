-- 261: Funil Step One — Lotes disponíveis: vincular condomínio + Quadra/Lote separados.

DO $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('lotes_disponiveis', 'stepone_lotes')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'lotes_disponiveis' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '261: fase lotes_disponiveis não encontrada; pulando.';
    RETURN;
  END IF;

  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id
    AND i.fase_id = v_fase_id
    AND i.label IN ('Identificação do lote', 'Identificação do lote (quadra/lote)');

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id
    AND label IN ('Identificação do lote', 'Identificação do lote (quadra/lote)');

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 1, 'Condomínio vinculado', 'condominio', true, true,
    'Selecione o condomínio do cadastro (Rede → Condomínios). O lote ficará anexado a esse cadastro.'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id AND i.label = 'Condomínio vinculado'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 2, 'Quadra', 'texto_curto', true, true, 'Ex.: 12'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i WHERE i.fase_id = v_fase_id AND i.label = 'Quadra'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  SELECT v_fase_id, 3, 'Lote', 'texto_curto', true, true, 'Ex.: 34'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i WHERE i.fase_id = v_fase_id AND i.label = 'Lote'
  );

  UPDATE public.kanban_fase_checklist_itens SET ordem = 4, label = 'Área m²', tipo = 'numero'
  WHERE fase_id = v_fase_id AND label IN ('Área m²', 'Área m² ');

  UPDATE public.kanban_fase_checklist_itens SET ordem = 5
  WHERE fase_id = v_fase_id AND label = 'Valor do lote (R$)';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 5
  WHERE fase_id = v_fase_id AND label = 'Valor estimado';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 6
  WHERE fase_id = v_fase_id AND label = 'Situação documental';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 7
  WHERE fase_id = v_fase_id AND label = 'Fotos do lote';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 8
  WHERE fase_id = v_fase_id AND label = 'Vista privilegiada';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 9
  WHERE fase_id = v_fase_id AND label = 'Perto de área verde';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 10
  WHERE fase_id = v_fase_id AND label = 'Muro';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 11
  WHERE fase_id = v_fase_id AND label = 'Perto de área de convivência';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 12
  WHERE fase_id = v_fase_id AND label = 'Perto de lixeira';

  UPDATE public.kanban_fase_checklist_itens SET ordem = 13
  WHERE fase_id = v_fase_id AND label = 'Observações adicionais sobre o lote';

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Vincule o lote a um condomínio existente no cadastro (Rede → Condomínios). Informe quadra e lote e complete os demais campos.
Os dados do lote ficam anexados ao cadastro do condomínio selecionado.
$instr$
  WHERE id = v_fase_id;
END;
$$;
