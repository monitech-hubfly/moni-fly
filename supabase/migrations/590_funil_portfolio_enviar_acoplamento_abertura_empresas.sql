-- 590: Funil Portfólio — Enviar Acoplamento Frank (após Acoplamento)
-- e Iniciar abertura empresas (antes de Diligência).
-- Idempotente. Não move cards.

DO $$
DECLARE
  v_kanban_id uuid := 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome = 'Funil Portfólio' AND COALESCE(ativo, true)
    ORDER BY id LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '590: Funil Portfólio não encontrado — pulando.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT '6b4f573d-74d5-40cf-b084-c3969af1a90b'::uuid, v_kanban_id, 'Enviar Acoplamento Frank', 'enviar_acoplamento_frank', 90, 3, true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'enviar_acoplamento_frank'
  );

  UPDATE public.kanban_fases
  SET nome = 'Enviar Acoplamento Frank', ativo = true, fase_conversao = false, sla_dias = 3
  WHERE kanban_id = v_kanban_id AND slug = 'enviar_acoplamento_frank';

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT '3cc52e93-b7ff-498b-a76a-97aa62bce058'::uuid, v_kanban_id, 'Iniciar abertura empresas', 'iniciar_abertura_empresas', 91, 3, true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'iniciar_abertura_empresas'
  );

  UPDATE public.kanban_fases
  SET nome = 'Iniciar abertura empresas', ativo = true, fase_conversao = false, sla_dias = 3
  WHERE kanban_id = v_kanban_id AND slug = 'iniciar_abertura_empresas';

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id FROM (
      VALUES
        (1,  'step_2'),
        (2,  'aprovacao_moni_novo_negocio'),
        (3,  'revisao_hipotese'),
        (4,  'step_3'),
        (5,  'juridico_opcao'),
        (6,  'assinaturas_opcao'),
        (7,  'opcao_assinada'),
        (8,  'step_4'),
        (9,  'pre_comite'),
        (10, 'revisoes_pre_comite'),
        (11, 'acoplamento'),
        (12, 'enviar_acoplamento_frank'),
        (13, 'step_5'),
        (14, 'revisoes_comite'),
        (15, 'segundo_comite'),
        (16, 'cto_condicoes_precedentes'),
        (17, 'juridico_cto_precedentes'),
        (18, 'assinaturas_cto_precedentes'),
        (19, 'cto_precedentes_assinado'),
        (20, 'iniciar_abertura_empresas'),
        (21, 'step_6'),
        (22, 'step_7'),
        (23, 'juridico_contrato'),
        (24, 'assinaturas_contrato'),
        (25, 'contrato_s_precedentes_assinado'),
        (26, 'passagem_wayser'),
        (27, 'convertidos')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf ON kf.kanban_id = v_kanban_id AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases SET ordem = v_ord, ativo = true WHERE id = r.id;
  END LOOP;

  UPDATE public.kanban_fases
  SET ordem = 900 + COALESCE(ordem, 0)
  WHERE kanban_id = v_kanban_id
    AND COALESCE(ativo, true) = false
    AND slug = 'captacao_moni_capital'
    AND ordem < 900;
END $$;

NOTIFY pgrst, 'reload schema';
