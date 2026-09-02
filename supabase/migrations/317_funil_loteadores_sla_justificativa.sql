-- 317: Justificativa de quebra de SLA — Funil Loteadores (Dados do Loteador, Fechar Contrato).

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS sla_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS sla_justificativa_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_justificativa_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.kanban_cards.sla_justificativa IS
  'Justificativa registrada para quebra de SLA na fase atual. Limpa ao mudar de fase.';
COMMENT ON COLUMN public.kanban_cards.sla_justificativa_em IS
  'Timestamp do registro da justificativa de SLA na fase atual.';
COMMENT ON COLUMN public.kanban_cards.sla_justificativa_por IS
  'Usuário que registrou a justificativa de SLA na fase atual.';

CREATE OR REPLACE FUNCTION public.fn_kanban_cards_entered_fase_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.entered_fase_at := COALESCE(NEW.entered_fase_at, NOW());
  ELSIF TG_OP = 'UPDATE' AND NEW.fase_id IS DISTINCT FROM OLD.fase_id THEN
    NEW.entered_fase_at := NOW();
    NEW.sla_justificativa := NULL;
    NEW.sla_justificativa_em := NULL;
    NEW.sla_justificativa_por := NULL;
  END IF;
  RETURN NEW;
END;
$$;
