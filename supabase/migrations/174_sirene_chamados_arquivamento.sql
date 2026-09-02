-- Arquivamento administrativo de chamados Sirene (lista unificada / painel).

ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento_sirene TEXT;

COMMENT ON COLUMN public.sirene_chamados.arquivado IS 'Chamado oculto da lista padrão; visível com “Mostrar arquivados” (admin/team).';
COMMENT ON COLUMN public.sirene_chamados.motivo_arquivamento_sirene IS 'Motivo obrigatório informado ao arquivar.';

CREATE INDEX IF NOT EXISTS idx_sirene_chamados_arquivado
  ON public.sirene_chamados (arquivado)
  WHERE arquivado = true;
