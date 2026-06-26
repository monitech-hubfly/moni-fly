-- 421: Aguardando Crédito — SLA 30 dias corridos (calculadora e funil Operações).

DO $$
DECLARE
  v_kanban_id uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
BEGIN
  UPDATE public.kanban_fases
  SET sla_dias = 30,
      sla_tipo = 'corridos'
  WHERE kanban_id = v_kanban_id
    AND slug = 'aguardando_credito';
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('421', 'aguardando_credito_sla_corridos')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
