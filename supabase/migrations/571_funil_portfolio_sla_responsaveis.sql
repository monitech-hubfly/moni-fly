-- 571: Funil Portfólio — SLA (dias) alinhado à tabela canônica de hipóteses.
-- Idempotente.

DO $$
DECLARE
  v_kanban_id uuid := 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome = 'Funil Portfólio' AND COALESCE(ativo, true)
    ORDER BY id LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '571: Funil Portfólio não encontrado — pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases SET sla_dias = v.sla
  FROM (VALUES
    ('step_2', 2),
    ('aprovacao_moni_novo_negocio', 2),
    ('revisao_hipotese', 2),
    ('step_3', 1),
    ('juridico_opcao', 3),
    ('assinaturas_opcao', 3),
    ('opcao_assinada', 1),
    ('step_4', 3),
    ('pre_comite', 3),
    ('revisoes_pre_comite', 1),
    ('acoplamento', 5),
    ('step_5', 3),
    ('revisoes_comite', 2),
    ('segundo_comite', 3),
    ('cto_condicoes_precedentes', 1),
    ('juridico_cto_precedentes', 3),
    ('assinaturas_cto_precedentes', 3),
    ('cto_precedentes_assinado', 1),
    ('step_6', 10),
    ('step_7', 1),
    ('juridico_contrato', 3),
    ('assinaturas_contrato', 3),
    ('contrato_s_precedentes_assinado', 1),
    ('passagem_wayser', 2)
  ) AS v(slug, sla)
  WHERE kanban_fases.kanban_id = v_kanban_id
    AND kanban_fases.slug = v.slug
    AND kanban_fases.sla_dias IS DISTINCT FROM v.sla;

  UPDATE public.kanban_fases
  SET sla_dias = NULL
  WHERE kanban_id = v_kanban_id
    AND slug = 'convertidos'
    AND sla_dias IS NOT NULL;
END $$;

NOTIFY pgrst, 'reload schema';
