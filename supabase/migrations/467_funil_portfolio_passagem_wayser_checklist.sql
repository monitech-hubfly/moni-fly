-- 467: Funil Portfólio — substitui o checklist operacional de Passagem para Wayser.
-- Mantém campos estruturais ocultos (ex.: responsável da fase) e remove suas respostas
-- somente dos itens operacionais substituídos.

DO $$
DECLARE
  v_fase_id uuid := '5f48a367-699b-4dc4-a310-377fc7d0ff88'::uuid;
  v_itens_removidos integer := 0;
  v_itens_inseridos integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f
    WHERE f.id = v_fase_id
      AND f.kanban_id = 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid
      AND f.slug = 'passagem_wayser'
  ) THEN
    RAISE EXCEPTION '[467] Fase passagem_wayser do Funil Portfólio não encontrada.';
  END IF;

  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id
    AND i.fase_id = v_fase_id
    AND COALESCE(i.config_json ->> 'oculto_ui', 'false') <> 'true';

  DELETE FROM public.kanban_fase_checklist_itens i
  WHERE i.fase_id = v_fase_id
    AND COALESCE(i.config_json ->> 'oculto_ui', 'false') <> 'true';
  GET DIAGNOSTICS v_itens_removidos = ROW_COUNT;

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
  GET DIAGNOSTICS v_itens_inseridos = ROW_COUNT;

  IF v_itens_inseridos <> 7 THEN
    RAISE EXCEPTION '[467] Checklist incompleto: % itens inseridos.', v_itens_inseridos;
  END IF;

  RAISE NOTICE '[467] Passagem para Wayser: % itens operacionais removidos e % inseridos.',
    v_itens_removidos, v_itens_inseridos;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('467', 'funil_portfolio_passagem_wayser_checklist')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
