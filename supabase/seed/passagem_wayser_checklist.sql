-- Seed espelho da migration 467: checklist de Passagem para Wayser.
-- Substitui somente os itens operacionais; preserva campos estruturais ocultos.

DO $$
DECLARE
  v_fase_id uuid := '5f48a367-699b-4dc4-a310-377fc7d0ff88'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f
    WHERE f.id = v_fase_id
      AND f.kanban_id = 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid
      AND f.slug = 'passagem_wayser'
  ) THEN
    RAISE EXCEPTION 'Fase passagem_wayser do Funil Portfólio não encontrada.';
  END IF;

  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id
    AND i.fase_id = v_fase_id
    AND COALESCE(i.config_json ->> 'oculto_ui', 'false') <> 'true';

  DELETE FROM public.kanban_fase_checklist_itens i
  WHERE i.fase_id = v_fase_id
    AND COALESCE(i.config_json ->> 'oculto_ui', 'false') <> 'true';

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  VALUES
    (v_fase_id, 1, 'CNPJ Incorp', 'checkbox', true, false, 'passagem_wayser_cnpj_incorp', '{}'::jsonb),
    (v_fase_id, 2, 'Conta Bancária Incorp', 'checkbox', true, false, 'passagem_wayser_conta_bancaria_incorp', '{}'::jsonb),
    (v_fase_id, 3, 'Diligência Terreno', 'checkbox', true, false, 'passagem_wayser_diligencia_terreno', '{}'::jsonb),
    (v_fase_id, 4, 'Fotos do Terreno', 'checkbox', true, false, 'passagem_wayser_fotos_terreno', '{}'::jsonb),
    (v_fase_id, 5, 'Acoplamento + Griffonbox + BCA Aprovado', 'checkbox', true, false, 'passagem_wayser_acoplamento_griffonbox_bca_aprovado', '{}'::jsonb),
    (v_fase_id, 6, 'Gadgets', 'checkbox', true, false, 'passagem_wayser_gadgets', '{}'::jsonb),
    (v_fase_id, 7, 'Contrato: Permuta ou CCV ASSINADO', 'checkbox', true, false, 'passagem_wayser_contrato_permuta_ou_ccv_assinado', '{}'::jsonb);
END $$;
