-- 478: P0 Histórico de Cards — RLS staff, fn_interacao_editada (220), tipo em triggers, campo before/after

-- ─── 1. RLS SELECT: team/supervisor (espelha 368 kanban_cards_select) ─────────
DROP POLICY IF EXISTS "kanban_historico_select" ON public.kanban_historico;
CREATE POLICY "kanban_historico_select"
  ON public.kanban_historico
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards kc
      WHERE kc.id = kanban_historico.card_id
        AND kc.franqueado_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = kanban_historico.card_id
        AND p.user_id = auth.uid()
    )
  );

-- ─── 2. Backfill tipo (NULL ou sistema com acao mapeável) ─────────────────────
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
  ELSE tipo
END
WHERE tipo IS NULL
   OR (
     tipo = 'sistema'
     AND acao IN (
       'fase_avancada', 'fase_retrocedida',
       'interacao_criada', 'interacao_editada', 'interacao_arquivada',
       'card_criado', 'card_arquivado', 'campo_alterado', 'comentario_criado',
       'tag_vinculada', 'tag_removida', 'links_gbox_acoplamento',
       'bastao_retorno', 'sla_justificado', 'card_finalizado', 'card_concluido'
     )
   );

-- ─── 3. Interação criada (card vinculado + tipo) ──────────────────────────────
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
      'status',       COALESCE(NEW.status, 'pendente'),
      'origem',       COALESCE(NEW.origem, 'nativo')
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_interacao_criada: erro ignorado — %', SQLERRM;
    RETURN NEW;
END;
$$;

-- ─── 4. Interação editada — restaura lógica 220 + tipo ────────────────────────
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
    INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, tipo, detalhe)
    VALUES (
      NEW.card_id,
      v_user_id,
      public.fn_resolve_usuario_nome(v_user_id),
      'interacao_arquivada',
      'interacao',
      jsonb_build_object('atividade_id', NEW.id, 'titulo', COALESCE(NEW.titulo, ''))
    );
    RETURN NEW;
  END IF;

  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  v_user_id := auth.uid();
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

-- ─── 5. Card concluído ────────────────────────────────────────────────────────
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

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, tipo, detalhe)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'card_concluido',
    'finalizacao',
    jsonb_build_object('concluido_em', COALESCE(NEW.concluido_em, now()))
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_card_concluido: erro ignorado — %', SQLERRM;
    RETURN NEW;
END;
$$;

-- ─── 6. Comentário criado ─────────────────────────────────────────────────────
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

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, tipo, detalhe)
  VALUES (
    NEW.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'comentario_criado',
    'comentario',
    jsonb_build_object('comentario_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_comentario_criado: erro ignorado — %', SQLERRM;
    RETURN NEW;
END;
$$;

-- ─── 7. Tags vinculada / removida ─────────────────────────────────────────────
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

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, tipo, detalhe)
  VALUES (
    NEW.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'tag_vinculada',
    'vinculo',
    jsonb_build_object('tag_id', NEW.tag_id, 'tag_nome', COALESCE(v_tag_nome, ''))
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_tag_vinculada: erro ignorado — %', SQLERRM;
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

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, tipo, detalhe)
  VALUES (
    OLD.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'tag_removida',
    'vinculo',
    jsonb_build_object('tag_id', OLD.tag_id, 'tag_nome', COALESCE(v_tag_nome, ''))
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_tag_removida: erro ignorado — %', SQLERRM;
    RETURN OLD;
END;
$$;

-- ─── 8. Campos do card — before/after + tipo ──────────────────────────────────
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
    v_campos := v_campos || jsonb_build_array(jsonb_build_object(
      'campo', 'titulo',
      'titulo_anterior', OLD.titulo,
      'titulo_novo', NEW.titulo
    ));
  END IF;

  IF OLD.data_reuniao IS DISTINCT FROM NEW.data_reuniao THEN
    v_campos := v_campos || jsonb_build_array(jsonb_build_object(
      'campo', 'data_reuniao',
      'data_reuniao_anterior', OLD.data_reuniao,
      'data_reuniao_nova', NEW.data_reuniao
    ));
  END IF;

  IF OLD.data_followup IS DISTINCT FROM NEW.data_followup THEN
    v_campos := v_campos || jsonb_build_array(jsonb_build_object(
      'campo', 'data_followup',
      'data_followup_anterior', OLD.data_followup,
      'data_followup_nova', NEW.data_followup
    ));
  END IF;

  IF OLD.nome_condominio IS DISTINCT FROM NEW.nome_condominio THEN
    v_campos := v_campos || jsonb_build_array(jsonb_build_object(
      'campo', 'nome_condominio',
      'nome_condominio_anterior', OLD.nome_condominio,
      'nome_condominio_novo', NEW.nome_condominio
    ));
  END IF;

  IF jsonb_array_length(v_campos) = 0 THEN
    RETURN NEW;
  END IF;

  v_user_id := auth.uid();

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, tipo, detalhe)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'campo_alterado',
    'campo',
    jsonb_build_object('campos', v_campos)
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_campo_card_alterado: erro ignorado — %', SQLERRM;
    RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
