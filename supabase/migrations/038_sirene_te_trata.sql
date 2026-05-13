-- Campo "Esse incêndio te trata?" para priorização de chamados
ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS te_trata BOOLEAN;

COMMENT ON COLUMN public.sirene_chamados.te_trata IS 'Resposta à pergunta "Esse incêndio te trata?" (sim/não). Usado para priorizar chamados.';
