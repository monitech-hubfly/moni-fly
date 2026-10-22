-- 654: Pós-Assinatura / Retroalimentação não conta atraso de SLA no Funil Jurídico.
-- Idempotente. DEV primeiro. PROD só com confirmação explícita.

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
    RAISE NOTICE '654: Funil Jurídico não encontrado — pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET sla_dias = NULL
  WHERE kanban_id = v_kanban_id
    AND slug IN ('juridico_pos_assinatura', 'juridico_retroalimentacao')
    AND sla_dias IS NOT NULL;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('654', 'juridico_pos_assinatura_sem_sla')
ON CONFLICT (version) DO NOTHING;
