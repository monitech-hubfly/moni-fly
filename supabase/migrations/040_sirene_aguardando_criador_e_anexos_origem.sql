-- Status para fluxo: quando Bombeiro preenche fechamento, chamado aguarda aprovação do criador.
ALTER TABLE public.sirene_chamados
  DROP CONSTRAINT IF EXISTS sirene_chamados_status_check;
ALTER TABLE public.sirene_chamados
  ADD CONSTRAINT sirene_chamados_status_check
  CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido', 'aguardando_aprovacao_criador'));

-- Origem do anexo: criador (abertura), time (tópico) ou bombeiro (fechamento).
ALTER TABLE public.sirene_anexos
  ADD COLUMN IF NOT EXISTS origem TEXT;

UPDATE public.sirene_anexos
SET origem = CASE
  WHEN topico_id IS NOT NULL THEN 'topico'
  ELSE 'criador'
END
WHERE origem IS NULL;

ALTER TABLE public.sirene_anexos
  DROP CONSTRAINT IF EXISTS sirene_anexos_origem_check;
ALTER TABLE public.sirene_anexos
  ADD CONSTRAINT sirene_anexos_origem_check
  CHECK (origem IS NULL OR origem IN ('criador', 'topico', 'fechamento_bombeiro'));

COMMENT ON COLUMN public.sirene_anexos.origem IS 'criador = anexo na abertura; topico = anexo da resolução do time; fechamento_bombeiro = anexo ao concluir chamado.';
