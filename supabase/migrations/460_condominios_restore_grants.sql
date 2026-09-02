-- 460: Restaura GRANTs em public.condominios (paridade PROD).
-- Em DEV o ACL chegou a ficar só com postgres (relacl null), bloqueando
-- SELECT/UPDATE via PostgREST (anon/authenticated/service_role) —
-- sintoma: "Salvar prazos de aprovação" não persistia.

GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON public.condominios TO anon, authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('460', 'condominios_restore_grants')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
