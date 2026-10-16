-- 631: Funil Acoplamento — fase Aguardando Comitê sem SLA.
-- Só limpa sla_dias. Checklist e respostas permanecem no mesmo fase_id.

UPDATE public.kanban_fases kf
SET sla_dias = NULL
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '15847602-231d-4937-a06f-82027eb87ef3'::uuid OR k.nome = 'Funil Acoplamento')
  AND kf.slug = 'aguardando_comite_acoplamento'
  AND kf.sla_dias IS NOT NULL;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('631', 'acoplamento_aguardando_comite_sem_sla')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
