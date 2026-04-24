-- 161: Tipos checklist `data` / `hora` + substituir item único por dois campos (Funil Moní INC — Primeiro Contato).

ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
  CHECK (tipo IN (
    'texto_curto',
    'texto_longo',
    'email',
    'telefone',
    'numero',
    'anexo',
    'anexo_template',
    'checkbox',
    'data',
    'hora'
  ));

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans WHERE nome = 'Funil Moní INC' LIMIT 1;
  IF v_kanban_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'primeiro_contato_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND label = 'Data e Horário da Reunião';

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
  SELECT v_fase_id, 1, 'Data da Reunião', 'data', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND label = 'Data da Reunião'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
  SELECT v_fase_id, 2, 'Horário da Reunião', 'hora', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND label = 'Horário da Reunião'
  );
END $$;
