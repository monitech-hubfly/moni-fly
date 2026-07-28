-- 493: Funil Crédito Obra — SLA da fase Novo Projeto: 2 dias úteis.
-- UUID: 6463af1d-850d-4958-b74c-404f8d668e21 (KANBAN_IDS.CREDITO_OBRA)

UPDATE public.kanban_fases kf
SET
  sla_dias = 2,
  sla_tipo = 'uteis'
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito'))
  AND kf.slug = 'co_novo_projeto';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('493', 'funil_credito_obra_sla_novo_projeto_2du')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
