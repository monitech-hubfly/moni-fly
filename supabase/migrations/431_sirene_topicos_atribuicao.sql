-- 431: adiciona colunas de aceite de atribuição em sirene_topicos.
--
-- DEFAULT 'aceito' para não afetar tópicos já existentes — registros ativos
-- já em andamento/concluídos não devem aparecer como "pendente_aceite"
-- retroativamente. Novas atribuições definirão 'pendente_aceite' via server action.
--
-- UUID usa REFERENCES auth.users(id) — padrão do projeto (prazo_abridor_id, arquivado_por).

ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS atribuicao_status TEXT DEFAULT 'aceito',
  ADD COLUMN IF NOT EXISTS atribuicao_recusado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS atribuicao_justificativa TEXT;

ALTER TABLE public.sirene_topicos DROP CONSTRAINT IF EXISTS sirene_topicos_atribuicao_status_check;
ALTER TABLE public.sirene_topicos
  ADD CONSTRAINT sirene_topicos_atribuicao_status_check
  CHECK (
    atribuicao_status IS NULL
    OR atribuicao_status IN ('pendente_aceite', 'aceito', 'recusado')
  );

COMMENT ON COLUMN public.sirene_topicos.atribuicao_status IS 'Estado do aceite de atribuição. pendente_aceite = aguardando aceite do responsável. aceito = aceito (default para pré-feature). recusado = recusado com justificativa.';
