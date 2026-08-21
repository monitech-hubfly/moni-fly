-- 410: Renomeia «Revisão do BCA» → «Revisão BCA + Instrumento Garantidor» e SLA 5 d.u. (slug inalterado: revisao_bca).

UPDATE public.kanban_fases
SET
  nome = 'Revisão BCA + Instrumento Garantidor',
  sla_dias = 5,
  sla_tipo = 'uteis'
WHERE slug = 'revisao_bca'
  AND (
    nome IS DISTINCT FROM 'Revisão BCA + Instrumento Garantidor'
    OR sla_dias IS DISTINCT FROM 5
    OR sla_tipo IS DISTINCT FROM 'uteis'
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('410', 'operacoes_fase_revisao_bca_instrumento')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
