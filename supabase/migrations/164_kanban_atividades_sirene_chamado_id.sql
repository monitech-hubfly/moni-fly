-- Liga cada linha origem=sirene em kanban_atividades ao sirene_chamados correspondente
-- (backfill alinhado à migration 120: criado_por + created_at).

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS sirene_chamado_id BIGINT REFERENCES public.sirene_chamados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.kanban_atividades.sirene_chamado_id IS
  'Quando origem = sirene, aponta para o registro em sirene_chamados (lista unificada / painel).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_atividades_sirene_chamado_id_unique
  ON public.kanban_atividades (sirene_chamado_id)
  WHERE sirene_chamado_id IS NOT NULL;

UPDATE public.kanban_atividades ka
SET sirene_chamado_id = sc.id
FROM public.sirene_chamados sc
WHERE ka.origem = 'sirene'
  AND ka.sirene_chamado_id IS NULL
  AND ka.criado_por IS NOT DISTINCT FROM sc.aberto_por
  AND ka.created_at = sc.created_at;

NOTIFY pgrst, 'reload schema';
