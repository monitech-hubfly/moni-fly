-- 505: Funil Projeto Legal — fases «Projeto Aprovado» (condomínio e prefeitura) sem SLA (conclusão).

UPDATE public.kanban_fases
SET
  sla_dias = NULL,
  sla_tipo = NULL
WHERE kanban_id = '39de341d-aebf-481c-9118-ce6fc6574187'::uuid
  AND slug IN ('pl_c_projeto_aprovado', 'pl_p_projeto_aprovado');

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('505', 'projeto_legal_projeto_aprovado_sem_sla')
ON CONFLICT (version) DO NOTHING;
