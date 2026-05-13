-- Cronologia do funil: registro de criação no histórico + data de conclusão (última fase).
-- card_criado alimenta o modal com fase inicial; concluido_em grava a primeira entrada na última fase.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMPTZ;

COMMENT ON COLUMN public.kanban_cards.concluido_em IS
  'Primeira vez em que o card entrou na última fase do kanban (ordem máxima). Preservado se o card voltar a fases anteriores.';

-- ─── Log card_criado (histórico) ao inserir card nativo ─────────────────────
CREATE OR REPLACE FUNCTION public.fn_kanban_card_criado_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
BEGIN
  SELECT nome INTO v_nome
  FROM public.kanban_fases
  WHERE id = NEW.fase_id
  LIMIT 1;

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe, criado_em)
  VALUES (
    NEW.id,
    COALESCE(auth.uid(), NEW.franqueado_id),
    public.fn_resolve_usuario_nome(COALESCE(auth.uid(), NEW.franqueado_id)),
    'card_criado',
    jsonb_build_object(
      'fase_id',       NEW.fase_id,
      'fase_nome',     COALESCE(v_nome, ''),
      'kanban_id',     NEW.kanban_id
    ),
    NEW.created_at
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_kanban_card_criado_historico: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_cards_criado_historico ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_criado_historico
  AFTER INSERT ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_kanban_card_criado_historico();

COMMENT ON FUNCTION public.fn_kanban_card_criado_historico() IS
  'Insere kanban_historico com acao card_criado (fase inicial) usando o timestamp de criação do card.';

-- Backfill: cards sem linha card_criado
INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe, criado_em)
SELECT
  kc.id,
  kc.franqueado_id,
  public.fn_resolve_usuario_nome(kc.franqueado_id),
  'card_criado',
  jsonb_build_object(
    'fase_id',   kc.fase_id,
    'fase_nome', COALESCE(kf.nome, ''),
    'kanban_id', kc.kanban_id
  ),
  kc.created_at
FROM public.kanban_cards kc
JOIN public.kanban_fases kf ON kf.id = kc.fase_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.kanban_historico h
  WHERE h.card_id = kc.id
    AND h.acao = 'card_criado'
);

-- ─── concluido_em: primeira entrada na última fase (por ordem) ──────────────
CREATE OR REPLACE FUNCTION public.fn_kanban_cards_concluido_ultima_fase()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max   INT;
  v_ordem INT;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.fase_id IS NOT DISTINCT FROM NEW.fase_id THEN
    RETURN NEW;
  END IF;

  SELECT MAX(kf.ordem) INTO v_max
  FROM public.kanban_fases kf
  WHERE kf.kanban_id = NEW.kanban_id
    AND COALESCE(kf.ativo, true);

  SELECT kf.ordem INTO v_ordem
  FROM public.kanban_fases kf
  WHERE kf.id = NEW.fase_id
  LIMIT 1;

  IF v_ordem IS NOT NULL AND v_max IS NOT NULL AND v_ordem = v_max THEN
    IF NEW.concluido_em IS NULL THEN
      NEW.concluido_em := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_cards_concluido_fase ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_concluido_fase
  BEFORE UPDATE OF fase_id ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_kanban_cards_concluido_ultima_fase();

COMMENT ON FUNCTION public.fn_kanban_cards_concluido_ultima_fase() IS
  'BEFORE UPDATE fase_id: na primeira entrada na fase de maior ordem do kanban, define concluido_em.';
