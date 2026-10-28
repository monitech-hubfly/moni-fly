-- 652: Funil Projeto Legal — renomeia "Em Validação" para "Validação e RRTs".
-- Slug pl_em_validacao permanece. Cards não são movidos.
-- Aplicar DEV primeiro; PROD somente com confirmação explícita.

UPDATE public.kanban_fases f
SET nome = 'Validação e RRTs'
FROM public.kanbans k
WHERE f.kanban_id = k.id
  AND f.slug = 'pl_em_validacao'
  AND (
    k.id = '39de341d-aebf-481c-9118-ce6fc6574187'::uuid
    OR k.nome = 'Funil Projeto Legal'
  );

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('652', 'projeto_legal_fase_validacao_rrts')
ON CONFLICT (version) DO NOTHING;
