-- Estrutura padronizada para avisos (ex.: menção em comentário de chamado)
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS mensagem TEXT,
  ADD COLUMN IF NOT EXISTS referencia_id BIGINT REFERENCES public.sirene_chamados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sirene_notificacoes.titulo IS 'Título curto do aviso (UI).';
COMMENT ON COLUMN public.sirene_notificacoes.mensagem IS 'Corpo do aviso; preferir este campo em novos tipos.';
COMMENT ON COLUMN public.sirene_notificacoes.referencia_id IS 'Referência principal (ex.: id do chamado Sirene).';

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_referencia
  ON public.sirene_notificacoes (referencia_id);
