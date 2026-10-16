-- 593: Funil Portfólio — Pré Comitê e Revisões Pré Comitê
-- passam a ficar logo depois de Revisão de Hipótese.
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
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '593: Funil Portfólio não encontrado — pulando.';
    RETURN;
  END IF;

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id FROM (
      VALUES
        (1,  'step_2'),
        (2,  'aprovacao_moni_novo_negocio'),
        (3,  'revisao_hipotese'),
        (4,  'pre_comite'),
        (5,  'revisoes_pre_comite'),
        (6,  'step_3'),
        (7,  'juridico_opcao'),
        (8,  'assinaturas_opcao'),
        (9,  'opcao_assinada'),
        (10, 'step_4'),
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
END $$;

NOTIFY pgrst, 'reload schema';
