-- 409: Renomeia fase «Processos Cartorários» → «Transferência do Terreno» (slug inalterado: processos_cartorarios).

UPDATE public.kanban_fases
SET nome = 'Transferência do Terreno'
WHERE slug = 'processos_cartorarios'
  AND nome IS DISTINCT FROM 'Transferência do Terreno';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('409', 'operacoes_fase_transferencia_terreno')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
