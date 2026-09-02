-- 498: GRANTs kanban_operacoes_tranche_vinculos (service_role + reforço authenticated).

GRANT SELECT, INSERT, UPDATE ON public.kanban_operacoes_tranche_vinculos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kanban_operacoes_tranche_vinculos TO service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('498', 'kanban_operacoes_tranche_vinculos_grants')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
