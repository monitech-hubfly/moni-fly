-- 560: Funil Portfólio — reestruturação de fases (Opção Assinada, Pré Comitê,
-- Revisões/2º Comitê, split CTO e Contrato, remove Captação, Convertidos).
-- Idempotente.

DO $$
DECLARE
  v_kanban_id uuid := 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid;
  v_fase_captacao uuid;
  v_fase_passagem uuid;
  v_fase_convertidos uuid := 'eda6139e-65f4-43d4-955f-026a488524be'::uuid;
  v_fase_cto uuid;
  v_fase_contrato uuid;
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
    RAISE NOTICE '560: Funil Portfólio não encontrado — pulando.';
    RETURN;
  END IF;

  -- ── Helper: insert fase se slug não existe ──────────────────────────────
  -- UUIDs fixos para FASE_IDS no código.

  -- Opção Assinada (após Assinaturas Opção)
  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT '32234ccf-6fa1-4f58-a9f8-418b02c22ef0'::uuid, v_kanban_id, 'Opção Assinada', 'opcao_assinada', 90, 1, true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'opcao_assinada');

  -- Pré Comitê (antes de Acoplamento)
  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT 'a4489f12-71a1-49f3-99ca-c500c58f799b'::uuid, v_kanban_id, 'Pré Comitê', 'pre_comite', 91, 3, true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'pre_comite');

  -- Revisões Comitê / 2º Comitê (após Comitê)
  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT '1c6ab47e-9b18-421b-8869-6c9ce2ab4c3a'::uuid, v_kanban_id, 'Revisões Comitê', 'revisoes_comite', 92, 3, true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'revisoes_comite');

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT 'a292ed7e-0c5c-4b23-9c09-82986c102b79'::uuid, v_kanban_id, '2º Comitê', 'segundo_comite', 93, 5, true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'segundo_comite');

  -- Split CTO: renomeia legado → Enviar; cria as 3 seguintes
  SELECT id INTO v_fase_cto
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'cto_condicoes_precedentes'
  LIMIT 1;

  IF v_fase_cto IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET nome = 'Enviar Cto c/ Precedentes'
    WHERE id = v_fase_cto AND nome IS DISTINCT FROM 'Enviar Cto c/ Precedentes';
  END IF;

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT '7d035a10-5403-44b5-819f-104786b48150'::uuid, v_kanban_id, 'Jurídico Cto c/ Precedentes', 'juridico_cto_precedentes', 94, 3, true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'juridico_cto_precedentes');

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT '27bc415f-4b70-4873-9cfc-5f51e7d925c8'::uuid, v_kanban_id, 'Assinaturas Cto c/ Precedentes', 'assinaturas_cto_precedentes', 95, 3, true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'assinaturas_cto_precedentes');

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT 'ee0e3aa9-6a18-410a-87a2-5f6210c4573f'::uuid, v_kanban_id, 'Cto c/ Precedentes Assinado', 'cto_precedentes_assinado', 96, 1, true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'cto_precedentes_assinado');

  -- Split Contrato: renomeia step_7 → Enviar; cria as 3 seguintes
  SELECT id INTO v_fase_contrato
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'step_7'
  LIMIT 1;

  IF v_fase_contrato IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET nome = 'Enviar Contrato s/ Precedentes'
    WHERE id = v_fase_contrato AND nome IS DISTINCT FROM 'Enviar Contrato s/ Precedentes';
  END IF;

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT 'e35fffc4-ddd9-412d-861b-3118697ae0b8'::uuid, v_kanban_id, 'Jurídico Contrato s/ Precedentes', 'juridico_contrato', 97, 3, true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'juridico_contrato');

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT '28601c1e-cd5a-4956-8eb6-9ba432588e60'::uuid, v_kanban_id, 'Assinaturas Contrato s/ Precedentes', 'assinaturas_contrato', 98, 3, true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'assinaturas_contrato');

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT '81bf57ac-48e5-4b9b-8eed-b416b9672e0e'::uuid, v_kanban_id, 'Contrato s/ Precedentes Assinado', 'contrato_s_precedentes_assinado', 99, 1, true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'contrato_s_precedentes_assinado');

  -- Passagem p/ Wayser (não conclusão) + Convertidos (conclusão)
  SELECT id INTO v_fase_passagem
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'passagem_wayser'
  LIMIT 1;

  IF v_fase_passagem IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET
      nome = 'Passagem p/ Wayser',
      fase_conversao = false
    WHERE id = v_fase_passagem;
  END IF;

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT v_fase_convertidos, v_kanban_id, 'Convertidos', 'convertidos', 100, NULL, true, true
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'convertidos');

  UPDATE public.kanban_fases
  SET nome = 'Convertidos', fase_conversao = true, ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'convertidos';

  -- Captação Moní Capital: move cards → Passagem; desativa fase
  SELECT id INTO v_fase_captacao
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'captacao_moni_capital'
  LIMIT 1;

  IF v_fase_captacao IS NOT NULL AND v_fase_passagem IS NOT NULL THEN
    UPDATE public.kanban_cards
    SET fase_id = v_fase_passagem
    WHERE fase_id = v_fase_captacao;

    UPDATE public.kanban_fases
    SET ativo = false, nome = 'Captação Moní Capital (inativa)'
    WHERE id = v_fase_captacao;
  ELSIF v_fase_captacao IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET ativo = false, nome = 'Captação Moní Capital (inativa)'
    WHERE id = v_fase_captacao;
  END IF;

  -- Ordem canônica final (ativas)
  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id, t.slug AS slug FROM (
      VALUES
        (1, 'step_2'),
        (2, 'aprovacao_moni_novo_negocio'),
        (3, 'step_3'),
        (4, 'juridico_opcao'),
        (5, 'assinaturas_opcao'),
        (6, 'opcao_assinada'),
        (7, 'step_4'),
        (8, 'pre_comite'),
        (9, 'acoplamento'),
        (10, 'step_5'),
        (11, 'revisoes_comite'),
        (12, 'segundo_comite'),
        (13, 'cto_condicoes_precedentes'),
        (14, 'juridico_cto_precedentes'),
        (15, 'assinaturas_cto_precedentes'),
        (16, 'cto_precedentes_assinado'),
        (17, 'step_6'),
        (18, 'step_7'),
        (19, 'juridico_contrato'),
        (20, 'assinaturas_contrato'),
        (21, 'contrato_s_precedentes_assinado'),
        (22, 'passagem_wayser'),
        (23, 'convertidos')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf ON kf.kanban_id = v_kanban_id AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases SET ordem = v_ord, ativo = true WHERE id = r.id;
  END LOOP;

  -- Empurra inativas para o fim
  UPDATE public.kanban_fases
  SET ordem = 900 + COALESCE(ordem, 0)
  WHERE kanban_id = v_kanban_id
    AND COALESCE(ativo, true) = false
    AND slug = 'captacao_moni_capital';
END $$;

NOTIFY pgrst, 'reload schema';
