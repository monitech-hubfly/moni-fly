-- 570: Funil Portfólio — hipóteses + fases de revisão.
-- Renomes: step_2 → Nova Hipótese; aprovacao_moni_novo_negocio → Análise de Nova Hipótese;
--          segundo_comite → Demais Comitês.
-- Novas: revisao_hipotese (após Análise); revisoes_pre_comite (após Pré Comitê).
-- Idempotente.

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
    RAISE NOTICE '570: Funil Portfólio não encontrado — pulando.';
    RETURN;
  END IF;

  -- Renomes (aceita nomes legados: Novo Estudo / Novo Negócio / Análise de Novo Negócio / 2º Comitê)
  UPDATE public.kanban_fases
  SET nome = 'Nova Hipótese'
  WHERE kanban_id = v_kanban_id
    AND slug = 'step_2'
    AND nome IS DISTINCT FROM 'Nova Hipótese';

  UPDATE public.kanban_fases
  SET nome = 'Análise de Nova Hipótese'
  WHERE kanban_id = v_kanban_id
    AND slug = 'aprovacao_moni_novo_negocio'
    AND nome IS DISTINCT FROM 'Análise de Nova Hipótese';

  UPDATE public.kanban_fases
  SET nome = 'Demais Comitês'
  WHERE kanban_id = v_kanban_id
    AND slug = 'segundo_comite'
    AND nome IS DISTINCT FROM 'Demais Comitês';

  -- Revisão de Hipótese (após Análise de Nova Hipótese)
  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT 'dcbb0e82-d436-4858-a124-00c97b2a5eb1'::uuid, v_kanban_id, 'Revisão de Hipótese', 'revisao_hipotese', 90, 3, true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'revisao_hipotese');

  UPDATE public.kanban_fases
  SET nome = 'Revisão de Hipótese', ativo = true, fase_conversao = false
  WHERE kanban_id = v_kanban_id AND slug = 'revisao_hipotese';

  -- Revisões Pré Comitê (após Pré Comitê)
  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT '7892bfcc-c737-422d-bfb1-d3d8db77fe05'::uuid, v_kanban_id, 'Revisões Pré Comitê', 'revisoes_pre_comite', 91, 3, true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'revisoes_pre_comite');

  UPDATE public.kanban_fases
  SET nome = 'Revisões Pré Comitê', ativo = true, fase_conversao = false
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_pre_comite';

  -- Ordem canônica final (ativas)
  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id, t.slug AS slug FROM (
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
        (12, 'step_5'),
        (13, 'revisoes_comite'),
        (14, 'segundo_comite'),
        (15, 'cto_condicoes_precedentes'),
        (16, 'juridico_cto_precedentes'),
        (17, 'assinaturas_cto_precedentes'),
        (18, 'cto_precedentes_assinado'),
        (19, 'step_6'),
        (20, 'step_7'),
        (21, 'juridico_contrato'),
        (22, 'assinaturas_contrato'),
        (23, 'contrato_s_precedentes_assinado'),
        (24, 'passagem_wayser'),
        (25, 'convertidos')
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
