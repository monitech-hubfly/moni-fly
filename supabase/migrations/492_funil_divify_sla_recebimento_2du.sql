-- 492: Funil Divify — SLA da fase Recebimento: 2 dias úteis.
-- UUID: 724aef36-37de-4454-bf6f-ec481693aeeb (KANBAN_IDS.MONI_CAPITAL)

UPDATE public.kanban_fases kf
SET
  sla_dias = 2,
  sla_tipo = 'uteis'
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid
    OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_recebimento';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('492', 'funil_divify_sla_recebimento_2du')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
