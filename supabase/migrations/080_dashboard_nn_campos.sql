-- Dashboard Novos Negócios: campos em processo_step_one (equivalente ao spec kanban_cards / dados_pre_obra)

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS data_aprovacao_credito date;

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS motivo_reprovacao_comite text,
  ADD COLUMN IF NOT EXISTS motivo_reprovacao_outro text,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento_outro text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'processo_step_one_motivo_reprovacao_comite_check'
  ) THEN
    ALTER TABLE public.processo_step_one
      ADD CONSTRAINT processo_step_one_motivo_reprovacao_comite_check
      CHECK (
        motivo_reprovacao_comite IS NULL OR motivo_reprovacao_comite IN (
          'Documentação incompleta',
          'SPT ausente ou insuficiente',
          'Inviabilidade financeira',
          'Terreno com restrições legais',
          'VGV abaixo do mínimo',
          'Prazo de aprovação inviável',
          'Desistência do franqueado',
          'Reprovação pelo condomínio',
          'Outro'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'processo_step_one_motivo_cancelamento_check'
  ) THEN
    ALTER TABLE public.processo_step_one
      ADD CONSTRAINT processo_step_one_motivo_cancelamento_check
      CHECK (
        motivo_cancelamento IS NULL OR motivo_cancelamento IN (
          'Terreno inviável',
          'Inviabilidade financeira',
          'Desistência do franqueado',
          'Condomínio não aprovou',
          'Prazo expirado',
          'Outro'
        )
      );
  END IF;
END $$;

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS fase_contabilidade text,
  ADD COLUMN IF NOT EXISTS fase_credito text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'processo_step_one_fase_contabilidade_check'
  ) THEN
    ALTER TABLE public.processo_step_one
      ADD CONSTRAINT processo_step_one_fase_contabilidade_check
      CHECK (
        fase_contabilidade IS NULL OR fase_contabilidade IN (
          'abertura_incorporadora',
          'abertura_spe',
          'abertura_gestora',
          'em_andamento',
          'encerrado'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'processo_step_one_fase_credito_check'
  ) THEN
    ALTER TABLE public.processo_step_one
      ADD CONSTRAINT processo_step_one_fase_credito_check
      CHECK (
        fase_credito IS NULL OR fase_credito IN (
          'check_legal_mais_credito',
          'contratacao_credito',
          'credito_aprovado',
          'encerrado'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.processo_step_one.data_aprovacao_credito IS 'Dados pré-obra: data de aprovação do crédito';
COMMENT ON COLUMN public.processo_step_one.fase_contabilidade IS 'Subfase exibida no dashboard (Kanban Contabilidade)';
COMMENT ON COLUMN public.processo_step_one.fase_credito IS 'Subfase exibida no dashboard (Kanban Crédito)';

-- Backfill fase_contabilidade a partir de etapa_painel (somente onde ainda NULL)
UPDATE public.processo_step_one
SET fase_contabilidade = CASE etapa_painel
  WHEN 'contabilidade_incorporadora' THEN 'abertura_incorporadora'
  WHEN 'contabilidade_spe' THEN 'abertura_spe'
  WHEN 'contabilidade_gestora' THEN 'abertura_gestora'
  ELSE fase_contabilidade
END
WHERE etapa_painel IN ('contabilidade_incorporadora', 'contabilidade_spe', 'contabilidade_gestora')
  AND fase_contabilidade IS NULL;

-- Backfill fase_credito
UPDATE public.processo_step_one
SET fase_credito = CASE etapa_painel
  WHEN 'credito_terreno' THEN 'check_legal_mais_credito'
  WHEN 'credito_obra' THEN 'contratacao_credito'
  ELSE fase_credito
END
WHERE etapa_painel IN ('credito_terreno', 'credito_obra')
  AND fase_credito IS NULL;

CREATE INDEX IF NOT EXISTS idx_processo_step_one_fase_contabilidade
  ON public.processo_step_one (fase_contabilidade)
  WHERE fase_contabilidade IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processo_step_one_fase_credito
  ON public.processo_step_one (fase_credito)
  WHERE fase_credito IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processo_step_one_cancelado_status
  ON public.processo_step_one (status, cancelado_em);
