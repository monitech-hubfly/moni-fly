-- 416: Projeto Legal (Funil Pré Obra e Obra) — SLA 5 d.u. → 10 d.u.

DO $$
DECLARE
  v_kanban_id uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
BEGIN
  UPDATE public.kanban_fases
  SET sla_dias = 10,
      sla_tipo = 'uteis'
  WHERE kanban_id = v_kanban_id
    AND slug = 'projeto_legal';
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('416', 'projeto_legal_sla_10_dias_uteis')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
