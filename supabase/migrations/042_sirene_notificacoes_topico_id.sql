-- Notificações Sirene: opcionalmente vinculadas a um tópico (ex.: atraso 2d, TOP 10)
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS topico_id BIGINT REFERENCES public.sirene_topicos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sirene_notificacoes.topico_id IS 'Tópico relacionado (ex.: notificação de atraso ou TOP 10).';

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_topico ON public.sirene_notificacoes(topico_id)
  WHERE topico_id IS NOT NULL;
