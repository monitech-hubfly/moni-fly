-- 429: campo classificacao_conclusao em sirene_topicos
-- Preenchido obrigatoriamente ao concluir uma atividade Sirene:
--   'pontual'    → ocorrência isolada
--   'recorrente' → padrão a monitorar (aparece em /sirene/pericias por padrão)
-- NULL = atividade não concluída ou migração pré-feature.

ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS classificacao_conclusao TEXT
    CHECK (classificacao_conclusao IN ('pontual', 'recorrente'))
    DEFAULT NULL;

COMMENT ON COLUMN public.sirene_topicos.classificacao_conclusao IS
  'Classificação de conclusão: pontual (isolada) ou recorrente (padrão a monitorar). Preenchido ao mudar status para concluido.';

CREATE INDEX IF NOT EXISTS idx_sirene_topicos_classificacao
  ON public.sirene_topicos (classificacao_conclusao)
  WHERE classificacao_conclusao IS NOT NULL;

NOTIFY pgrst, 'reload schema';
