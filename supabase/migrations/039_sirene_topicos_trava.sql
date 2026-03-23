-- Trava por tópico (além da trava do chamado)
ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS trava BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.sirene_topicos.trava IS 'Se este tópico tem trava (bloqueia avanço até ser resolvido).';
