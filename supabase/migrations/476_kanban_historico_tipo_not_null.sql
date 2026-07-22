-- 471: kanban_historico.tipo NOT NULL + triggers alinhados
-- Coluna `tipo` já existe em DEV/PROD sem default; inserts do app e triggers
-- que omitiam `tipo` quebravam (ex.: Abrir Funil Acoplamento / espelho calculadora).

ALTER TABLE public.kanban_historico
  ADD COLUMN IF NOT EXISTS tipo text;

UPDATE public.kanban_historico
SET tipo = CASE
  WHEN acao IN ('fase_avancada', 'fase_retrocedida') THEN 'fase'
  WHEN acao IN ('interacao_criada', 'interacao_editada', 'interacao_arquivada') THEN 'interacao'
  WHEN acao = 'card_criado' THEN 'criacao'
  WHEN acao = 'card_arquivado' THEN 'arquivamento'
  WHEN acao = 'campo_alterado' THEN 'campo'
  WHEN acao = 'comentario_criado' THEN 'comentario'
  WHEN acao IN ('tag_vinculada', 'tag_removida', 'links_gbox_acoplamento') THEN 'vinculo'
  WHEN acao = 'bastao_retorno' THEN 'bastao'
  WHEN acao = 'sla_justificado' THEN 'sla'
  WHEN acao IN ('card_finalizado', 'card_concluido') THEN 'finalizacao'
  ELSE 'sistema'
END
WHERE tipo IS NULL;

ALTER TABLE public.kanban_historico
  ALTER COLUMN tipo SET DEFAULT 'sistema';

ALTER TABLE public.kanban_historico
  ALTER COLUMN tipo SET NOT NULL;

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
    'card_finalizado',
    'comentario_criado',
    'tag_vinculada',
    'tag_removida',
    'bastao_retorno',
    'sla_justificado',
    'links_gbox_acoplamento'
  ));

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

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, tipo, detalhe)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    v_acao,
    'fase',
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
    RAISE WARNING 'fn_historico_fase_alterada: erro ignorado — %', SQLERRM;
    RETURN NEW;
END;
$$;

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

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, tipo, detalhe)
  VALUES (
    NEW.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'interacao_criada',
    'interacao',
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

  IF OLD.titulo IS DISTINCT FROM NEW.titulo THEN
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
    v_detalhe := v_detalhe || jsonb_build_object('descricao_alterada', true);
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

  v_detalhe := v_detalhe || jsonb_build_object('atividade_id', NEW.id);

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, tipo, detalhe)
  VALUES (
    NEW.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'interacao_editada',
    'interacao',
    v_detalhe
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_interacao_editada: erro ignorado — %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_kanban_card_criado_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
  v_user_id UUID;
BEGIN
  SELECT nome INTO v_nome FROM public.kanban_fases WHERE id = NEW.fase_id LIMIT 1;
  v_user_id := COALESCE(auth.uid(), NEW.franqueado_id);

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, tipo, detalhe, criado_em)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'card_criado',
    'criacao',
    jsonb_build_object(
      'fase_id',   NEW.fase_id,
      'fase_nome', COALESCE(v_nome, ''),
      'kanban_id', NEW.kanban_id
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

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, tipo, detalhe)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'card_arquivado',
    'arquivamento',
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

NOTIFY pgrst, 'reload schema';
