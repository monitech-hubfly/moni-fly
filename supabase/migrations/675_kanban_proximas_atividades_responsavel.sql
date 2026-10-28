-- 675: responsável da próxima atividade (profile), sem apagar linhas já gravadas.

ALTER TABLE public.kanban_proximas_atividades
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.kanban_proximas_atividades.responsavel_id IS
  'Profile responsável pela atividade. Distinto de criado_por e concluido_por.';

CREATE INDEX IF NOT EXISTS kanban_proximas_atividades_responsavel_idx
  ON public.kanban_proximas_atividades (responsavel_id);

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('675', 'kanban_proximas_atividades_responsavel')
ON CONFLICT (version) DO NOTHING;
