-- 632: Funil Jurídico — fase Enviado ao Parceiro sem SLA.
-- Só limpa sla_dias. Checklist e respostas permanecem no mesmo fase_id.

UPDATE public.kanban_fases kf
SET sla_dias = NULL
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid OR k.nome = 'Funil Jurídico')
  AND kf.slug = 'juridico_enviado_parceiro'
  AND kf.sla_dias IS NOT NULL;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('632', 'juridico_enviado_parceiro_sem_sla')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
