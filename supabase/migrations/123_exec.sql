ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS arquivado          BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_por      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

COMMENT ON COLUMN public.kanban_cards.arquivado IS
  'Se true, card está arquivado e não aparece nas listagens ativas.';
COMMENT ON COLUMN public.kanban_cards.arquivado_em IS
  'Timestamp do arquivamento.';
COMMENT ON COLUMN public.kanban_cards.arquivado_por IS
  'Usuário que arquivou o card.';
COMMENT ON COLUMN public.kanban_cards.motivo_arquivamento IS
  'Motivo opcional informado ao arquivar.';

CREATE INDEX IF NOT EXISTS idx_kanban_cards_arquivado
  ON public.kanban_cards (arquivado) WHERE arquivado = true;

ALTER TABLE public.kanban_historico
  DROP CONSTRAINT IF EXISTS kanban_historico_acao_check;

ALTER TABLE public.kanban_historico
  ADD CONSTRAINT kanban_historico_acao_check
  CHECK (acao IN (
    'card_criado',
    'fase_avancada',
    'fase_retrocedida',
    'interacao_criada',
    'interacao_editada',
    'campo_alterado',
    'card_arquivado'
  ));

CREATE OR REPLACE FUNCTION public.fn_log_arquivamento_card()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT (OLD.arquivado IS DISTINCT FROM NEW.arquivado AND NEW.arquivado = true) THEN
    RETURN NEW;
  END IF;

  v_user_id := COALESCE(auth.uid(), NEW.arquivado_por);

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'card_arquivado',
    jsonb_build_object(
      'motivo',       COALESCE(NEW.motivo_arquivamento, ''),
      'arquivado_em', COALESCE(NEW.arquivado_em, now())
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_log_arquivamento_card: erro ignorado — %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_cards_arquivamento ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_arquivamento
  AFTER UPDATE OF arquivado ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_arquivamento_card();

COMMENT ON FUNCTION public.fn_log_arquivamento_card() IS
  'Registra card_arquivado em kanban_historico quando arquivado muda para true. '
  'Inclui motivo e timestamp no detalhe JSONB.';

UPDATE public.kanban_fases
SET sla_dias = 7
WHERE sla_dias IS NULL;

ALTER TABLE public.kanban_fases
  ALTER COLUMN sla_dias SET DEFAULT 7;

COMMENT ON COLUMN public.kanban_fases.sla_dias IS
  'SLA em dias úteis para cards nesta fase. Default 7. Configurável via fn_atualizar_sla_fase().';

CREATE OR REPLACE FUNCTION public.fn_atualizar_sla_fase(
  p_fase_id  UUID,
  p_sla_dias INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_sla_dias IS NULL OR p_sla_dias < 1 OR p_sla_dias > 365 THEN
    RAISE EXCEPTION 'sla_dias deve ser um inteiro entre 1 e 365. Recebido: %', p_sla_dias;
  END IF;

  UPDATE public.kanban_fases
  SET sla_dias = p_sla_dias
  WHERE id = p_fase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fase não encontrada: %', p_fase_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_atualizar_sla_fase(UUID, INTEGER) IS
  'Atualiza sla_dias de uma fase. Valida intervalo 1–365 e lança exceção se a fase não existir.';

GRANT EXECUTE ON FUNCTION public.fn_atualizar_sla_fase(UUID, INTEGER) TO authenticated;
