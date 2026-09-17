-- 572: Funil Jurídico — SLA (dias úteis) alinhado à tabela canônica do time jurídico.
-- Idempotente. UUID canônico: KANBAN_IDS.JURIDICO.

DO $$
DECLARE
  v_kanban_id uuid := '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome = 'Funil Jurídico'
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '572: Funil Jurídico não encontrado — pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases kf
  SET
    sla_dias = v.sla_dias,
    sla_tipo = 'uteis'
  FROM (VALUES
    ('juridico_recebimento',             1),
    ('juridico_analise_inicial',         1),
    ('juridico_alteracoes_respostas',    1),
    ('juridico_enviado_parceiro',        5),
    ('juridico_subir_assinatura',        1),
    ('juridico_aguardando_assinaturas',  3),
    ('juridico_pos_assinatura',          2)
  ) AS v(slug, sla_dias)
  WHERE kf.kanban_id = v_kanban_id
    AND kf.slug = v.slug
    AND (
      kf.sla_dias IS DISTINCT FROM v.sla_dias
      OR kf.sla_tipo IS DISTINCT FROM 'uteis'
    );

  UPDATE public.kanban_fases
  SET
    sla_dias = NULL,
    sla_tipo = 'uteis'
  WHERE kanban_id = v_kanban_id
    AND slug = 'juridico_atendimentos_concluidos'
    AND sla_dias IS NOT NULL;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('572', 'funil_juridico_sla')
ON CONFLICT (version) DO NOTHING;
