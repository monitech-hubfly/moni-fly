-- ─── 108: kanban_historico + triggers automáticos ────────────────────────────
-- Tabela de auditoria de cards: registra mudanças de fase e interações.
-- Triggers SECURITY DEFINER garantem escrita mesmo com RLS ativo.
-- RLS SELECT: usuário só vê histórico de cards aos quais tem acesso.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ─── 1. Tabela kanban_historico ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kanban_historico (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  usuario_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nome TEXT,           -- desnormalizado: evita JOIN em consultas de auditoria
  acao         TEXT        NOT NULL
                           CHECK (acao IN (
                             'card_criado',
                             'fase_avancada',
                             'fase_retrocedida',
                             'interacao_criada',
                             'interacao_editada',
                             'campo_alterado'
                           )),
  detalhe      JSONB,          -- dados extras contextuais (fases, campos, valores)
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_historico_card_id
  ON public.kanban_historico (card_id);

CREATE INDEX IF NOT EXISTS idx_kanban_historico_criado_em
  ON public.kanban_historico (criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_kanban_historico_acao
  ON public.kanban_historico (acao);

CREATE INDEX IF NOT EXISTS idx_kanban_historico_detalhe
  ON public.kanban_historico USING GIN (detalhe);

COMMENT ON TABLE public.kanban_historico IS
  'Log de auditoria de cards do kanban: mudanças de fase e interações. '
  'Populado exclusivamente via triggers — nunca inserir manualmente.';

-- ─── 2. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.kanban_historico ENABLE ROW LEVEL SECURITY;

-- SELECT: usuário vê histórico dos cards que já tem acesso
-- (replica a lógica de kanban_cards_select sem criar dependência circular)
DROP POLICY IF EXISTS "kanban_historico_select" ON public.kanban_historico;
CREATE POLICY "kanban_historico_select"
  ON public.kanban_historico FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards kc
      WHERE kc.id = kanban_historico.card_id
        AND (
          kc.franqueado_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('admin', 'consultor')
          )
        )
    )
  );

GRANT SELECT ON public.kanban_historico TO authenticated;

-- ─── 3. Helper: resolve nome do usuário ───────────────────────────────────────
-- Usada pelas funções de trigger para desnormalizar usuario_nome.
CREATE OR REPLACE FUNCTION public.fn_resolve_usuario_nome(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(full_name, email)
  FROM   public.profiles
  WHERE  id = p_user_id
  LIMIT  1;
$$;

-- ─── 4a. Trigger: mudança de fase em kanban_cards ─────────────────────────────
-- Dispara AFTER UPDATE quando fase_id muda.
-- Compara kanban_fases.ordem para decidir se é avanço ou retrocesso.

CREATE OR REPLACE FUNCTION public.fn_historico_fase_alterada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ordem_antiga  INT;
  v_ordem_nova    INT;
  v_nome_antiga   TEXT;
  v_nome_nova     TEXT;
  v_acao          TEXT;
  v_user_id       UUID;
BEGIN
  -- Sem mudança efetiva de fase: nada a registrar
  IF OLD.fase_id IS NOT DISTINCT FROM NEW.fase_id THEN
    RETURN NEW;
  END IF;

  -- Busca metadados das fases
  SELECT ordem, nome INTO v_ordem_antiga, v_nome_antiga
  FROM public.kanban_fases WHERE id = OLD.fase_id;

  SELECT ordem, nome INTO v_ordem_nova, v_nome_nova
  FROM public.kanban_fases WHERE id = NEW.fase_id;

  -- Determina direção do movimento
  v_acao := CASE
    WHEN COALESCE(v_ordem_nova, 0) >= COALESCE(v_ordem_antiga, 0) THEN 'fase_avancada'
    ELSE 'fase_retrocedida'
  END;

  v_user_id := auth.uid();

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    v_acao,
    jsonb_build_object(
      'fase_anterior_id',   OLD.fase_id,
      'fase_anterior_nome', COALESCE(v_nome_antiga, ''),
      'fase_nova_id',       NEW.fase_id,
      'fase_nova_nome',     COALESCE(v_nome_nova, '')
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_fase_alterada: erro ignorado — %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_cards_historico_fase ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_historico_fase
  AFTER UPDATE OF fase_id ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_fase_alterada();

COMMENT ON FUNCTION public.fn_historico_fase_alterada() IS
  'Registra fase_avancada ou fase_retrocedida ao mover card entre fases. '
  'Direção determinada comparando kanban_fases.ordem das fases anterior e nova.';

-- ─── 4b. Trigger: nova interação em kanban_atividades ─────────────────────────
CREATE OR REPLACE FUNCTION public.fn_historico_interacao_criada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(auth.uid(), NEW.criado_por);

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'interacao_criada',
    jsonb_build_object(
      'atividade_id', NEW.id,
      'titulo',       COALESCE(NEW.titulo, ''),
      'tipo',         COALESCE(NEW.tipo, 'atividade'),
      'status',       COALESCE(NEW.status, 'pendente')
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_interacao_criada: erro ignorado — %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_atividades_historico_insert ON public.kanban_atividades;
CREATE TRIGGER trg_kanban_atividades_historico_insert
  AFTER INSERT ON public.kanban_atividades
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_interacao_criada();

COMMENT ON FUNCTION public.fn_historico_interacao_criada() IS
  'Registra interacao_criada ao inserir uma nova atividade num card.';

-- ─── 4c. Trigger: edição de interação em kanban_atividades ───────────────────
CREATE OR REPLACE FUNCTION public.fn_historico_interacao_editada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_detalhe JSONB := '{}'::JSONB;
BEGIN
  v_user_id := auth.uid();

  -- Registra campos que efetivamente mudaram
  IF OLD.titulo   IS DISTINCT FROM NEW.titulo THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'titulo_anterior', OLD.titulo,
      'titulo_novo',     NEW.titulo
    );
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'status_anterior', OLD.status,
      'status_novo',     NEW.status
    );
  END IF;

  IF OLD.descricao IS DISTINCT FROM NEW.descricao THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'descricao_alterada', true
    );
  END IF;

  IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'responsavel_anterior', OLD.responsavel_id,
      'responsavel_novo',     NEW.responsavel_id
    );
  END IF;

  IF OLD.data_vencimento IS DISTINCT FROM NEW.data_vencimento THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'data_vencimento_anterior', OLD.data_vencimento,
      'data_vencimento_nova',     NEW.data_vencimento
    );
  END IF;

  -- Sempre inclui identificador da atividade
  v_detalhe := v_detalhe || jsonb_build_object('atividade_id', NEW.id);

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'interacao_editada',
    v_detalhe
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_interacao_editada: erro ignorado — %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_atividades_historico_update ON public.kanban_atividades;
CREATE TRIGGER trg_kanban_atividades_historico_update
  AFTER UPDATE ON public.kanban_atividades
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_interacao_editada();

COMMENT ON FUNCTION public.fn_historico_interacao_editada() IS
  'Registra interacao_editada ao atualizar uma atividade. '
  'detalhe inclui apenas os campos que efetivamente mudaram.';
