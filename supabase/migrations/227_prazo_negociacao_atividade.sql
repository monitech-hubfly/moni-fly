-- 227: Negociação de prazo em atividades (sirene_topicos + kanban_atividades)

ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS prazo_proposto DATE,
  ADD COLUMN IF NOT EXISTS prazo_status TEXT,
  ADD COLUMN IF NOT EXISTS prazo_abridor_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS prazo_proposto_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS prazo_aceito_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prazo_negociacao_expira_em TIMESTAMPTZ;

ALTER TABLE public.sirene_topicos DROP CONSTRAINT IF EXISTS sirene_topicos_prazo_status_check;
ALTER TABLE public.sirene_topicos
  ADD CONSTRAINT sirene_topicos_prazo_status_check
  CHECK (
    prazo_status IS NULL
    OR prazo_status IN (
      'pendente_aceite_responsavel',
      'pendente_aceite_abridor',
      'aceito',
      'recusado'
    )
  );

COMMENT ON COLUMN public.sirene_topicos.prazo_proposto IS 'Data proposta em negociação; vira data_fim quando aceita.';
COMMENT ON COLUMN public.sirene_topicos.prazo_status IS 'Estado da negociação de prazo limite.';
COMMENT ON COLUMN public.sirene_topicos.prazo_abridor_id IS 'Quem abriu a atividade (aceita contraproposta do responsável).';
COMMENT ON COLUMN public.sirene_topicos.prazo_proposto_por IS 'Autor da proposta de prazo atual.';
COMMENT ON COLUMN public.sirene_topicos.prazo_aceito_em IS 'Quando o prazo foi aceito (oficial para SLA).';
COMMENT ON COLUMN public.sirene_topicos.prazo_negociacao_expira_em IS 'Fim da janela de 24h para alteração livre do prazo.';

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS prazo_proposto DATE,
  ADD COLUMN IF NOT EXISTS prazo_status TEXT,
  ADD COLUMN IF NOT EXISTS prazo_abridor_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS prazo_proposto_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS prazo_aceito_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prazo_negociacao_expira_em TIMESTAMPTZ;

ALTER TABLE public.kanban_atividades DROP CONSTRAINT IF EXISTS kanban_atividades_prazo_status_check;
ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_prazo_status_check
  CHECK (
    prazo_status IS NULL
    OR prazo_status IN (
      'pendente_aceite_responsavel',
      'pendente_aceite_abridor',
      'aceito',
      'recusado'
    )
  );

COMMENT ON COLUMN public.kanban_atividades.prazo_proposto IS 'Prazo proposto no cabeçalho do chamado (quando sem sub-atividades).';
COMMENT ON COLUMN public.kanban_atividades.prazo_status IS 'Negociação de data_vencimento no chamado.';

-- Legado: prazo já gravado em data_fim / data_vencimento conta como aceito
UPDATE public.sirene_topicos
SET
  prazo_status = 'aceito',
  prazo_proposto = data_fim,
  prazo_aceito_em = COALESCE(prazo_aceito_em, created_at, now())
WHERE data_fim IS NOT NULL
  AND (prazo_status IS NULL OR prazo_status = '');

UPDATE public.kanban_atividades
SET
  prazo_status = 'aceito',
  prazo_proposto = data_vencimento,
  prazo_aceito_em = COALESCE(prazo_aceito_em, created_at, now())
WHERE data_vencimento IS NOT NULL
  AND (prazo_status IS NULL OR prazo_status = '');
