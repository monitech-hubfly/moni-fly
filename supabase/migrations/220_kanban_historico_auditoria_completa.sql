-- 220: auditoria completa em kanban_historico — nome do usuário, mais ações, triggers corrigidos

-- ─── Resolver nome (perfil + e-mail) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_resolve_usuario_nome(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(trim(p.full_name), ''),
    NULLIF(trim(p.email), ''),
    'Usuário'
  )
  FROM public.profiles p
  WHERE p.id = p_user_id
  LIMIT 1;
$$;

-- Backfill nomes ausentes em registros antigos
UPDATE public.kanban_historico kh
SET usuario_nome = public.fn_resolve_usuario_nome(kh.usuario_id)
WHERE kh.usuario_id IS NOT NULL
  AND (kh.usuario_nome IS NULL OR trim(kh.usuario_nome) = '');

-- ─── Expandir tipos de ação ───────────────────────────────────────────────────
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
    'interacao_arquivada',
    'campo_alterado',
    'card_arquivado',
    'card_concluido',
    'comentario_criado',
    'tag_vinculada',
    'tag_removida'
  ));

-- ─── Fase: usuário = quem moveu (auth ou colunas futuras) ─────────────────────
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
  IF OLD.fase_id IS NOT DISTINCT FROM NEW.fase_id THEN
    RETURN NEW;
  END IF;

  SELECT ordem, nome INTO v_ordem_antiga, v_nome_antiga
  FROM public.kanban_fases WHERE id = OLD.fase_id;

  SELECT ordem, nome INTO v_ordem_nova, v_nome_nova
  FROM public.kanban_fases WHERE id = NEW.fase_id;

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
      'fase_anterior_id',     OLD.fase_id,
      'fase_anterior_nome',   COALESCE(v_nome_antiga, ''),
      'fase_anterior_ordem',  v_ordem_antiga,
      'fase_nova_id',         NEW.fase_id,
      'fase_nova_nome',       COALESCE(v_nome_nova, ''),
      'fase_nova_ordem',      v_ordem_nova
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_fase_alterada: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- ─── Interação criada (somente com card vinculado) ───────────────────────────
CREATE OR REPLACE FUNCTION public.fn_historico_interacao_criada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NEW.card_id IS NULL THEN
    RETURN NEW;
  END IF;

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
      'status',       COALESCE(NEW.status, 'pendente'),
      'origem',       COALESCE(NEW.origem, 'nativo')
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_interacao_criada: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- ─── Interação editada (somente se houve mudança relevante) ──────────────────
CREATE OR REPLACE FUNCTION public.fn_historico_interacao_editada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_detalhe JSONB := '{}'::JSONB;
  v_changed BOOLEAN := false;
BEGIN
  IF NEW.card_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.titulo IS DISTINCT FROM NEW.titulo THEN
    v_changed := true;
    v_detalhe := v_detalhe || jsonb_build_object('titulo_anterior', OLD.titulo, 'titulo_novo', NEW.titulo);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_changed := true;
    v_detalhe := v_detalhe || jsonb_build_object('status_anterior', OLD.status, 'status_novo', NEW.status);
  END IF;

  IF OLD.descricao IS DISTINCT FROM NEW.descricao THEN
    v_changed := true;
    v_detalhe := v_detalhe || jsonb_build_object('descricao_alterada', true);
  END IF;

  IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
    v_changed := true;
    v_detalhe := v_detalhe || jsonb_build_object(
      'responsavel_anterior', OLD.responsavel_id,
      'responsavel_novo',     NEW.responsavel_id
    );
  END IF;

  IF OLD.data_vencimento IS DISTINCT FROM NEW.data_vencimento THEN
    v_changed := true;
    v_detalhe := v_detalhe || jsonb_build_object(
      'data_vencimento_anterior', OLD.data_vencimento,
      'data_vencimento_nova',     NEW.data_vencimento
    );
  END IF;

  IF OLD.arquivado IS DISTINCT FROM NEW.arquivado AND NEW.arquivado = true THEN
    v_user_id := COALESCE(auth.uid(), NEW.criado_por);
    INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
    VALUES (
      NEW.card_id,
      v_user_id,
      public.fn_resolve_usuario_nome(v_user_id),
      'interacao_arquivada',
      jsonb_build_object('atividade_id', NEW.id, 'titulo', COALESCE(NEW.titulo, ''))
    );
    RETURN NEW;
  END IF;

  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  v_user_id := auth.uid();
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
    RAISE WARNING 'fn_historico_interacao_editada: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- ─── Card concluído ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_historico_card_concluido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT (OLD.concluido IS DISTINCT FROM NEW.concluido AND NEW.concluido = true) THEN
    RETURN NEW;
  END IF;

  v_user_id := COALESCE(auth.uid(), NEW.concluido_por);

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'card_concluido',
    jsonb_build_object('concluido_em', COALESCE(NEW.concluido_em, now()))
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_card_concluido: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_cards_historico_concluido ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_historico_concluido
  AFTER UPDATE OF concluido ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_card_concluido();

-- ─── Comentário no card ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_historico_comentario_criado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(NEW.autor_id, auth.uid());

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'comentario_criado',
    jsonb_build_object('comentario_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_comentario_criado: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_comentarios_historico ON public.kanban_card_comentarios;
CREATE TRIGGER trg_kanban_comentarios_historico
  AFTER INSERT ON public.kanban_card_comentarios
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_comentario_criado();

-- ─── Tags vinculadas / removidas ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_historico_tag_vinculada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tag_nome TEXT;
BEGIN
  v_user_id := auth.uid();
  SELECT nome INTO v_tag_nome FROM public.kanban_tags WHERE id = NEW.tag_id;

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'tag_vinculada',
    jsonb_build_object('tag_id', NEW.tag_id, 'tag_nome', COALESCE(v_tag_nome, ''))
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_tag_vinculada: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_historico_tag_removida()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tag_nome TEXT;
BEGIN
  v_user_id := auth.uid();
  SELECT kt.nome INTO v_tag_nome
  FROM public.kanban_tags kt
  WHERE kt.id = OLD.tag_id;

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    OLD.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'tag_removida',
    jsonb_build_object('tag_id', OLD.tag_id, 'tag_nome', COALESCE(v_tag_nome, ''))
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_tag_removida: %', SQLERRM;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_card_tags_historico_ins ON public.kanban_card_tags;
CREATE TRIGGER trg_kanban_card_tags_historico_ins
  AFTER INSERT ON public.kanban_card_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_tag_vinculada();

DROP TRIGGER IF EXISTS trg_kanban_card_tags_historico_del ON public.kanban_card_tags;
CREATE TRIGGER trg_kanban_card_tags_historico_del
  AFTER DELETE ON public.kanban_card_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_tag_removida();

-- ─── Campos principais do card ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_historico_campo_card_alterado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_campos JSONB := '[]'::JSONB;
BEGIN
  IF OLD.titulo IS DISTINCT FROM NEW.titulo THEN
    v_campos := v_campos || jsonb_build_array(jsonb_build_object('campo', 'titulo'));
  END IF;
  IF OLD.data_reuniao IS DISTINCT FROM NEW.data_reuniao THEN
    v_campos := v_campos || jsonb_build_array(jsonb_build_object('campo', 'data_reuniao'));
  END IF;
  IF OLD.data_followup IS DISTINCT FROM NEW.data_followup THEN
    v_campos := v_campos || jsonb_build_array(jsonb_build_object('campo', 'data_followup'));
  END IF;
  IF OLD.nome_condominio IS DISTINCT FROM NEW.nome_condominio THEN
    v_campos := v_campos || jsonb_build_array(jsonb_build_object('campo', 'nome_condominio'));
  END IF;

  IF jsonb_array_length(v_campos) = 0 THEN
    RETURN NEW;
  END IF;

  v_user_id := auth.uid();

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'campo_alterado',
    jsonb_build_object('campos', v_campos)
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_campo_card_alterado: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_cards_historico_campos ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_historico_campos
  AFTER UPDATE OF titulo, data_reuniao, data_followup, nome_condominio ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_campo_card_alterado();

NOTIFY pgrst, 'reload schema';
