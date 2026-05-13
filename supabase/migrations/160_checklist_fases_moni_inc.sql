-- 160: Checklist por fase — Funil Moní INC (idempotente por fase_id + label).
-- Tipos `data` / `hora` (alinhado à 161 em bases que já aplicaram apenas a 160 antiga).

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
    RAISE NOTICE '160_checklist_fases_moni_inc: kanban Funil Moní INC não encontrado; pulando.';
    RETURN;
  END IF;

  -- Primeiro Contato
  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'primeiro_contato_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NOT NULL THEN
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
  END IF;

  -- R2 Apresentar Plano Teórico
  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'r2_plano_teorico_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NOT NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    SELECT v_fase_id, v.ordem, v.label, 'anexo', true, true
    FROM (VALUES (1, 'Ficha de Cadastro'), (2, 'Calculadora BCA'), (3, '1º Acoplamento')) AS v(ordem, label)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND label = v.label
    );
  END IF;

  -- R3 Ajustes Finais nas Propostas
  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'r3_ajustes_finais_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NOT NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    SELECT v_fase_id, 1, 'EmoU', 'anexo', true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND label = 'EmoU'
    );
  END IF;

  -- Fechar Contrato
  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'fechar_contrato_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NOT NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    SELECT v_fase_id, 1, 'Contrato', 'anexo', true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND label = 'Contrato'
    );
  END IF;
END $$;
