-- â”€â”€â”€ 121: sirene_topicos como sub-interaÃ§Ã£o sÃ³ de kanban (sem chamado) â”€â”€â”€â”€â”€â”€â”€
-- Permite chamado_id NULL quando interacao_id aponta para kanban_atividades.
-- Ajusta RLS para linhas vinculadas a interaÃ§Ã£o (acesso alinhado ao card/atividade).

ALTER TABLE public.sirene_topicos
  ALTER COLUMN chamado_id DROP NOT NULL;

COMMENT ON COLUMN public.sirene_topicos.chamado_id IS
  'Chamado Sirene (legado). NULL quando o tÃ³pico Ã© sub-interaÃ§Ã£o de kanban_atividades (interacao_id).';

ALTER TABLE public.sirene_topicos
  DROP CONSTRAINT IF EXISTS sirene_topicos_chamado_ou_interacao_chk;

ALTER TABLE public.sirene_topicos
  ADD CONSTRAINT sirene_topicos_chamado_ou_interacao_chk
  CHECK (chamado_id IS NOT NULL OR interacao_id IS NOT NULL);

DROP POLICY IF EXISTS "sirene_topicos_all" ON public.sirene_topicos;

CREATE POLICY "sirene_topicos_all"
  ON public.sirene_topicos FOR ALL
  USING (
    (
      sirene_topicos.chamado_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM   public.sirene_chamados c
        WHERE  c.id = sirene_topicos.chamado_id
          AND (
            c.aberto_por = auth.uid()
            OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
            OR public.user_has_topic_on_chamado(c.id, auth.uid())
          )
      )
    )
    OR (
      sirene_topicos.interacao_id IS NOT NULL
      AND (
        auth.uid() = ANY (COALESCE(sirene_topicos.responsaveis_ids, '{}'))
        OR sirene_topicos.responsavel_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM   public.kanban_atividades a
          WHERE  a.id = sirene_topicos.interacao_id
            AND (
              EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role IN ('admin', 'consultor')
              )
              OR EXISTS (
                SELECT 1 FROM public.kanban_cards kc
                WHERE kc.id = a.card_id
                  AND a.origem = 'nativo'
                  AND kc.franqueado_id = auth.uid()
              )
              OR (
                a.origem = 'legado'
                AND EXISTS (
                  SELECT 1 FROM public.processo_step_one p
                  WHERE p.id = a.card_id
                    AND p.user_id = auth.uid()
                )
              )
              OR a.responsavel_id = auth.uid()
              OR auth.uid() = ANY (COALESCE(a.responsaveis_ids, '{}'))
              OR a.criado_por = auth.uid()
            )
        )
      )
    )
  );
-- â”€â”€â”€ 122: seed de interaÃ§Ãµes de exemplo para teste do Painel Sirene â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Insere kanban_atividades para cards nativos (Funil Step One) e interaÃ§Ãµes
-- diretas origem='sirene' (sem card). Idempotente: filtra por titulo+card_id.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” InteraÃ§Ãµes para cards do Funil Step One (nativo)
-- Usa os 5 primeiros cards ativos para nÃ£o saturar o banco dev.
-- ============================================================
INSERT INTO public.kanban_atividades
  (card_id, titulo, descricao, tipo, status, data_vencimento, origem, time,
   criado_por, responsavel_id, responsaveis_ids)
SELECT
  kc.id                                     AS card_id,
  t.titulo,
  t.descricao,
  t.tipo,
  t.status,
  t.data_vencimento,
  'nativo'                                  AS origem,
  t.time,
  kc.franqueado_id                          AS criado_por,
  kc.franqueado_id                          AS responsavel_id,
  CASE WHEN kc.franqueado_id IS NOT NULL
    THEN ARRAY[kc.franqueado_id]
    ELSE '{}'::uuid[]
  END                                       AS responsaveis_ids
FROM (
  SELECT id, franqueado_id
  FROM   public.kanban_cards
  ORDER  BY created_at DESC
  LIMIT  5
) kc
CROSS JOIN (
  VALUES
    ('Preparar relatÃ³rio fotogrÃ¡fico da regiÃ£o',
     'Fazer registros visuais dos principais pontos de interesse',
     'atividade', 'pendente',     CURRENT_DATE - INTERVAL '7 days',  'operacoes'),
    ('Agendar reuniÃ£o com corretores locais',
     'Marcar encontro para entender dinÃ¢mica do mercado imobiliÃ¡rio',
     'duvida',    'pendente',     CURRENT_DATE + INTERVAL '1 day',   'comercial'),
    ('Solicitar certidÃµes e documentos',
     'Reunir toda documentaÃ§Ã£o legal para anÃ¡lise de viabilidade',
     'atividade', 'em_andamento', CURRENT_DATE + INTERVAL '5 days',  'juridico')
) AS t(titulo, descricao, tipo, status, data_vencimento, time)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_atividades ka
  WHERE ka.card_id = kc.id
    AND ka.titulo  = t.titulo
    AND ka.origem  = 'nativo'
);

-- ============================================================
-- PARTE 2 â€” InteraÃ§Ãµes diretas origem='sirene' (sem card)
-- Vinculadas aos 3 chamados mais recentes para teste do painel.
-- ============================================================
INSERT INTO public.kanban_atividades
  (card_id, titulo, descricao, tipo, status, data_vencimento, origem, time,
   criado_por, responsavel_id, responsaveis_ids, trava)
SELECT
  NULL                                           AS card_id,
  t.titulo,
  t.descricao,
  t.tipo,
  t.status,
  t.data_vencimento,
  'sirene'                                       AS origem,
  t.time,
  sc.aberto_por                                  AS criado_por,
  sc.aberto_por                                  AS responsavel_id,
  CASE WHEN sc.aberto_por IS NOT NULL
    THEN ARRAY[sc.aberto_por]
    ELSE '{}'::uuid[]
  END                                            AS responsaveis_ids,
  t.trava
FROM (
  SELECT id, aberto_por
  FROM   public.sirene_chamados
  ORDER  BY created_at DESC
  LIMIT  3
) sc
CROSS JOIN (
  VALUES
    ('AnÃ¡lise de impacto da ocorrÃªncia',
     'Levantar dados de recorrÃªncia e raiz do problema',
     'atividade', 'pendente',     CURRENT_DATE + INTERVAL '2 days',  'operacoes', false),
    ('Documentar resoluÃ§Ã£o no sistema',
     'Registrar passos da soluÃ§Ã£o para base de conhecimento',
     'atividade', 'em_andamento', CURRENT_DATE + INTERVAL '3 days',  'operacoes', false),
    ('Validar com o time jurÃ­dico',
     'Confirmar se hÃ¡ implicaÃ§Ãµes contratuais',
     'duvida',    'pendente',     CURRENT_DATE - INTERVAL '1 day',   'juridico',  true)
) AS t(titulo, descricao, tipo, status, data_vencimento, time, trava)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_atividades ka
  WHERE ka.criado_por = sc.aberto_por
    AND ka.titulo     = t.titulo
    AND ka.origem     = 'sirene'
);

-- ============================================================
-- PARTE 3 â€” Sub-interaÃ§Ãµes (sirene_topicos) vinculadas Ã s
-- interaÃ§Ãµes sirene criadas na PARTE 2
-- ============================================================
INSERT INTO public.sirene_topicos
  (interacao_id, chamado_id, ordem, descricao, time_responsavel, status, trava,
   responsaveis_ids)
SELECT
  ka.id                       AS interacao_id,
  NULL                        AS chamado_id,
  st.ordem,
  st.descricao,
  st.time_responsavel,
  st.status,
  false                       AS trava,
  CASE WHEN ka.responsavel_id IS NOT NULL
    THEN ARRAY[ka.responsavel_id]
    ELSE '{}'::uuid[]
  END                         AS responsaveis_ids
FROM public.kanban_atividades ka
CROSS JOIN (
  VALUES
    (1, 'Coletar evidÃªncias do incidente',   'operacoes',  'nao_iniciado'),
    (2, 'Elaborar relatÃ³rio de encerramento','operacoes',  'em_andamento'),
    (3, 'Apresentar Ã  Caneta Verde',         'juridico',   'nao_iniciado')
) AS st(ordem, descricao, time_responsavel, status)
WHERE ka.origem = 'sirene'
  AND NOT EXISTS (
    SELECT 1 FROM public.sirene_topicos stt
    WHERE stt.interacao_id = ka.id
      AND stt.descricao    = st.descricao
  )
ORDER BY ka.created_at DESC
LIMIT 9;
-- â”€â”€â”€ 123: arquivamento de cards + SLA configurÃ¡vel em fases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Parte 1: colunas de arquivamento em kanban_cards + trigger de log.
-- Parte 2: SLA padrÃ£o 7 dias em kanban_fases + fn_atualizar_sla_fase().
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” Arquivamento em kanban_cards
-- ============================================================

-- 1a. Novas colunas
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS arquivado          BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_por      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

COMMENT ON COLUMN public.kanban_cards.arquivado IS
  'Se true, card estÃ¡ arquivado e nÃ£o aparece nas listagens ativas.';
COMMENT ON COLUMN public.kanban_cards.arquivado_em IS
  'Timestamp do arquivamento.';
COMMENT ON COLUMN public.kanban_cards.arquivado_por IS
  'UsuÃ¡rio que arquivou o card.';
COMMENT ON COLUMN public.kanban_cards.motivo_arquivamento IS
  'Motivo opcional informado ao arquivar.';

-- 1b. Ãndice parcial â€” sÃ³ indexa cards arquivados (minoria)
CREATE INDEX IF NOT EXISTS idx_kanban_cards_arquivado
  ON public.kanban_cards (arquivado) WHERE arquivado = true;

-- 1c. Expandir check de kanban_historico.acao para incluir card_arquivado
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

-- 1d. Trigger: loga arquivamento quando arquivado muda de false â†’ true
CREATE OR REPLACE FUNCTION public.fn_log_arquivamento_card()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- SÃ³ dispara quando arquivado efetivamente virou true
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
  RAISE WARNING 'fn_log_arquivamento_card: erro ignorado â€” %', SQLERRM;
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

-- ============================================================
-- PARTE 2 â€” SLA configurÃ¡vel em kanban_fases
-- ============================================================

-- 2a. Preencher sla_dias nulos restantes e fixar default
UPDATE public.kanban_fases
SET sla_dias = 7
WHERE sla_dias IS NULL;

ALTER TABLE public.kanban_fases
  ALTER COLUMN sla_dias SET DEFAULT 7;

COMMENT ON COLUMN public.kanban_fases.sla_dias IS
  'SLA em dias Ãºteis para cards nesta fase. Default 7. ConfigurÃ¡vel via fn_atualizar_sla_fase().';

-- 2b. FunÃ§Ã£o para atualizar SLA de uma fase com validaÃ§Ã£o
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
    RAISE EXCEPTION 'Fase nÃ£o encontrada: %', p_fase_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_atualizar_sla_fase(UUID, INTEGER) IS
  'Atualiza sla_dias de uma fase. Valida intervalo 1â€“365 e lanÃ§a exceÃ§Ã£o se a fase nÃ£o existir.';

GRANT EXECUTE ON FUNCTION public.fn_atualizar_sla_fase(UUID, INTEGER) TO authenticated;
-- â”€â”€â”€ 124: finalizaÃ§Ã£o de cards + mÃ©tricas de retrabalho + SLA acumulado â”€â”€â”€â”€â”€â”€
-- Parte 1: colunas concluido/concluido_em/concluido_por em kanban_cards.
-- Parte 2: coluna is_retrocesso em kanban_historico + trigger fn_marcar_retrocesso.
-- Parte 3: substituiÃ§Ã£o de fn_historico_fase_alterada (108) para incluir ordens no detalhe.
-- Parte 4: sla_dias_acumulados em kanban_cards.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” Colunas de finalizaÃ§Ã£o em kanban_cards
-- ============================================================

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS concluido       BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS concluido_em    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concluido_por   UUID        REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.kanban_cards.concluido IS
  'Se true, card foi finalizado manualmente.';
COMMENT ON COLUMN public.kanban_cards.concluido_em IS
  'Timestamp da finalizaÃ§Ã£o do card.';
COMMENT ON COLUMN public.kanban_cards.concluido_por IS
  'UsuÃ¡rio que finalizou o card.';

-- ============================================================
-- PARTE 2 â€” MÃ©tricas de retrabalho em kanban_historico
-- ============================================================

ALTER TABLE public.kanban_historico
  ADD COLUMN IF NOT EXISTS is_retrocesso BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.kanban_historico.is_retrocesso IS
  'true quando a mudanÃ§a de fase representa retrocesso (fase_nova_ordem < fase_anterior_ordem).';

-- Trigger que marca is_retrocesso logo apÃ³s inserÃ§Ã£o no histÃ³rico.
-- Depende de fase_anterior_ordem e fase_nova_ordem presentes no detalhe JSONB
-- (garantidos pelo fn_historico_fase_alterada atualizado na Parte 3).
CREATE OR REPLACE FUNCTION public.fn_marcar_retrocesso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.acao IN ('fase_avancada', 'fase_retrocedida')
     AND (NEW.detalhe->>'fase_nova_ordem') IS NOT NULL
     AND (NEW.detalhe->>'fase_anterior_ordem') IS NOT NULL
  THEN
    UPDATE public.kanban_historico
    SET is_retrocesso = (
      (NEW.detalhe->>'fase_nova_ordem')::int < (NEW.detalhe->>'fase_anterior_ordem')::int
    )
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marcar_retrocesso ON public.kanban_historico;
CREATE TRIGGER trg_marcar_retrocesso
  AFTER INSERT ON public.kanban_historico
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_marcar_retrocesso();

COMMENT ON FUNCTION public.fn_marcar_retrocesso() IS
  'Marca is_retrocesso=true quando fase_nova_ordem < fase_anterior_ordem no detalhe JSONB.';

-- ============================================================
-- PARTE 3 â€” Atualiza fn_historico_fase_alterada (migration 108)
--           para incluir fase_anterior_ordem e fase_nova_ordem no detalhe
-- ============================================================

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
    RAISE WARNING 'fn_historico_fase_alterada: erro ignorado â€” %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_historico_fase_alterada() IS
  'Registra fase_avancada ou fase_retrocedida ao mover card entre fases. '
  'detalhe inclui ids, nomes e ordens das fases anterior e nova (necessÃ¡rio para is_retrocesso).';

-- Backfill: marcar is_retrocesso em linhas histÃ³ricas que jÃ¡ tenham ordens no detalhe
UPDATE public.kanban_historico
SET is_retrocesso = (
  (detalhe->>'fase_nova_ordem')::int < (detalhe->>'fase_anterior_ordem')::int
)
WHERE acao IN ('fase_avancada', 'fase_retrocedida')
  AND (detalhe->>'fase_nova_ordem') IS NOT NULL
  AND (detalhe->>'fase_anterior_ordem') IS NOT NULL;

-- ============================================================
-- PARTE 4 â€” SLA acumulado por card
-- ============================================================

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS sla_dias_acumulados INTEGER DEFAULT 0;

COMMENT ON COLUMN public.kanban_cards.sla_dias_acumulados IS
  'Dias Ãºteis de SLA jÃ¡ consumidos antes do retrocesso de fase. '
  'Nunca Ã© zerado em retrocessos â€” preserva o tempo jÃ¡ gasto no processo.';
-- Cronologia do funil: registro de criaÃ§Ã£o no histÃ³rico + data de conclusÃ£o (Ãºltima fase).
-- card_criado alimenta o modal com fase inicial; concluido_em grava a primeira entrada na Ãºltima fase.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMPTZ;

COMMENT ON COLUMN public.kanban_cards.concluido_em IS
  'Primeira vez em que o card entrou na Ãºltima fase do kanban (ordem mÃ¡xima). Preservado se o card voltar a fases anteriores.';

-- â”€â”€â”€ Log card_criado (histÃ³rico) ao inserir card nativo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  'Insere kanban_historico com acao card_criado (fase inicial) usando o timestamp de criaÃ§Ã£o do card.';

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

-- â”€â”€â”€ concluido_em: primeira entrada na Ãºltima fase (por ordem) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
-- FinalizaÃ§Ã£o explÃ­cita de card (aÃ§Ã£o finalizarCard) + colunas concluido / concluido_por.
-- Remove o trigger antigo que gravava concluido_em ao entrar na Ãºltima fase (125): concluido_em passa a ser sÃ³ da finalizaÃ§Ã£o.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS concluido BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS concluido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.kanban_cards.concluido IS 'Card finalizado pelo usuÃ¡rio (server action finalizarCard).';
COMMENT ON COLUMN public.kanban_cards.concluido_por IS 'UsuÃ¡rio que finalizou o card.';

COMMENT ON COLUMN public.kanban_cards.concluido_em IS
  'Timestamp definido em finalizarCard quando concluido = true.';

DROP TRIGGER IF EXISTS trg_kanban_cards_concluido_fase ON public.kanban_cards;
DROP FUNCTION IF EXISTS public.fn_kanban_cards_concluido_ultima_fase();

-- Limpa timestamps antigos gerados pelo trigger removido (card ainda nÃ£o finalizado)
UPDATE public.kanban_cards
SET concluido_em = NULL
WHERE concluido IS NOT TRUE;
-- Caminho do contrato de franquia (Storage bucket contratos-franquia).
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS contrato_franquia_path TEXT;

COMMENT ON COLUMN public.rede_franqueados.contrato_franquia_path IS
  'Caminho no bucket contratos-franquia (ex.: {id}/arquivo.pdf).';

-- Bucket privado para anexos de contrato de franquia (modal Kanban).
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos-franquia', 'contratos-franquia', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "contratos_franquia_insert_auth" ON storage.objects;
CREATE POLICY "contratos_franquia_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contratos-franquia');

DROP POLICY IF EXISTS "contratos_franquia_select_auth" ON storage.objects;
CREATE POLICY "contratos_franquia_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contratos-franquia');

DROP POLICY IF EXISTS "contratos_franquia_update_auth" ON storage.objects;
CREATE POLICY "contratos_franquia_update_auth"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contratos-franquia');

DROP POLICY IF EXISTS "contratos_franquia_delete_auth" ON storage.objects;
CREATE POLICY "contratos_franquia_delete_auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contratos-franquia');

-- Consultores podem atualizar processos da carteira (prÃ©-obra no modal Kanban).
DROP POLICY IF EXISTS "Consultor atualiza processos da carteira" ON public.processo_step_one;
CREATE POLICY "Consultor atualiza processos da carteira"
  ON public.processo_step_one FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = public.processo_step_one.user_id AND p.consultor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = public.processo_step_one.user_id AND p.consultor_id = auth.uid()
    )
  );

-- Consultores podem atualizar rede (ex.: caminho do contrato).
DROP POLICY IF EXISTS "rede_franqueados_update_consultor" ON public.rede_franqueados;
CREATE POLICY "rede_franqueados_update_consultor"
  ON public.rede_franqueados FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'consultor'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'consultor'));
-- Migration 128: Kanban "Funil Acoplamento" + 4 fases (idempotente).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PARTE 1 â€” Registrar o kanban
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
INSERT INTO public.kanbans (nome, descricao)
SELECT 'Funil Acoplamento', 'GestÃ£o do processo de acoplamento de terreno e casa'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans WHERE nome = 'Funil Acoplamento'
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PARTE 2 â€” Inserir as 4 fases
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
SELECT
  k.id,
  fase.nome,
  fase.slug,
  fase.ordem,
  7 AS sla_dias,
  true AS ativo
FROM public.kanbans k
CROSS JOIN (VALUES
  ('Modelagem do Terreno', 'modelagem_terreno', 1),
  ('Modelagem da Casa + GBox', 'modelagem_casa_gbox', 2),
  ('ValidaÃ§Ã£o do Acoplamento', 'validacao_acoplamento', 3),
  ('AlteraÃ§Ãµes do Acoplamento', 'alteracoes_acoplamento', 4)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'Funil Acoplamento'
ON CONFLICT DO NOTHING;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PARTE 3 â€” Garantir GRANTs
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
GRANT SELECT ON public.kanbans TO authenticated, anon;
GRANT SELECT ON public.kanban_fases TO authenticated, anon;
-- â”€â”€â”€ 129: InstruÃ§Ãµes e materiais em kanban_fases (modal kanban) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.kanban_fases
  ADD COLUMN IF NOT EXISTS instrucoes TEXT,
  ADD COLUMN IF NOT EXISTS materiais JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.kanban_fases.instrucoes IS
  'OrientaÃ§Ãµes da fase exibidas no KanbanCardModal.';
COMMENT ON COLUMN public.kanban_fases.materiais IS
  'JSON array: [{"titulo","url","tipo"}]; tipo: link | documento | video.';

-- ApÃ³s 099 (sÃ³ SELECT em kanban_fases): permitir UPDATE para admin/consultor.
DROP POLICY IF EXISTS "kanban_fases_update_admin_consultor" ON public.kanban_fases;
CREATE POLICY "kanban_fases_update_admin_consultor"
  ON public.kanban_fases
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );
-- â”€â”€â”€ 130: VÃ­nculos entre cards nativos (relacionamentos no modal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.kanban_card_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_origem_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  card_destino_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  tipo_vinculo TEXT NOT NULL DEFAULT 'relacionado'
    CHECK (tipo_vinculo IN ('relacionado', 'depende_de', 'bloqueia')),
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(card_origem_id, card_destino_id),
  CHECK (card_origem_id <> card_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_kanban_card_vinculos_origem
  ON public.kanban_card_vinculos(card_origem_id);
CREATE INDEX IF NOT EXISTS idx_kanban_card_vinculos_destino
  ON public.kanban_card_vinculos(card_destino_id);

COMMENT ON TABLE public.kanban_card_vinculos IS
  'Relacionamentos entre cards: origem â†’ destino conforme tipo_vinculo.';

ALTER TABLE public.kanban_card_vinculos ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuÃ¡rio autenticado (card visÃ­vel no modal jÃ¡ passou RLS do card).
DROP POLICY IF EXISTS "kanban_card_vinculos_select_auth" ON public.kanban_card_vinculos;
CREATE POLICY "kanban_card_vinculos_select_auth"
  ON public.kanban_card_vinculos
  FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: admin e consultor (alinhado a outras tabelas de configuraÃ§Ã£o do kanban).
DROP POLICY IF EXISTS "kanban_card_vinculos_insert_admin" ON public.kanban_card_vinculos;
CREATE POLICY "kanban_card_vinculos_insert_admin"
  ON public.kanban_card_vinculos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "kanban_card_vinculos_delete_admin" ON public.kanban_card_vinculos;
CREATE POLICY "kanban_card_vinculos_delete_admin"
  ON public.kanban_card_vinculos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

GRANT SELECT ON public.kanban_card_vinculos TO authenticated;
GRANT INSERT, DELETE ON public.kanban_card_vinculos TO authenticated;
-- â”€â”€â”€ 131: Convites Portal Frank (link 7 dias) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.convites_frank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT (gen_random_uuid()::text),
  email TEXT,
  franqueado_id UUID REFERENCES public.rede_franqueados(id) ON DELETE SET NULL,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  usado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convites_frank_token ON public.convites_frank(token);
CREATE INDEX IF NOT EXISTS idx_convites_frank_expira ON public.convites_frank(expira_em);

COMMENT ON TABLE public.convites_frank IS
  'Convite por link para cadastro no portal do franqueado (7 dias). Leitura/aceite via service role nas routes.';

ALTER TABLE public.convites_frank ENABLE ROW LEVEL SECURITY;

-- Apenas admin/consultor gerencia convites autenticados.
DROP POLICY IF EXISTS "convites_frank_select_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_select_admin"
  ON public.convites_frank FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_insert_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_insert_admin"
  ON public.convites_frank FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_update_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_update_admin"
  ON public.convites_frank FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.convites_frank TO authenticated;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cargo TEXT
  CHECK (cargo IN ('adm', 'analista', 'estagiario'));

COMMENT ON COLUMN public.profiles.cargo IS
  'Cargo dentro do grupo: adm, analista ou estagiario';

UPDATE public.profiles
SET role = 'team'
WHERE role = 'consultor';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'team', 'frank', 'parceiro', 'fornecedor', 'cliente'));

DO $$
DECLARE
  r       RECORD;
  v_qual  TEXT;
  v_check TEXT;
  v_sql   TEXT;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schemaname,
      c.relname AS tablename,
      p.polname AS policyname,
      CASE p.polpermissive WHEN true THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS permissive,
      CASE p.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        ELSE 'ALL'
      END AS cmd,
      pg_get_expr(p.polqual,      p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
    FROM pg_policy p
    JOIN pg_class     c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        pg_get_expr(p.polqual,      p.polrelid) LIKE '%consultor%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%consultor%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);

    v_qual  := replace(
                 replace(r.qual,  '''consultor''::text', '''team'''),
                 '''consultor''', '''team''');
    v_check := replace(
                 replace(r.with_check, '''consultor''::text', '''team'''),
                 '''consultor''', '''team''');

    v_sql := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO authenticated',
      r.policyname, r.schemaname, r.tablename, r.permissive, r.cmd);

    IF v_qual IS NOT NULL THEN
      v_sql := v_sql || ' USING (' || v_qual || ')';
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || ' WITH CHECK (' || v_check || ')';
    END IF;

    EXECUTE v_sql;
    RAISE NOTICE 'Policy atualizada: % em %.%', r.policyname, r.schemaname, r.tablename;
  END LOOP;
END;
$$;

GRANT SELECT ON public.profiles TO authenticated, anon;
CREATE TABLE IF NOT EXISTS public.permissoes_perfil (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role       TEXT NOT NULL,
  cargo      TEXT NOT NULL,
  permissao  TEXT NOT NULL,
  valor      BOOLEAN DEFAULT true,
  criado_em  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, cargo, permissao)
);

COMMENT ON TABLE public.permissoes_perfil IS
  'Matriz de permissÃµes por role + cargo. Lida pelo frontend para controlar acesso a aÃ§Ãµes.';

ALTER TABLE public.permissoes_perfil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissoes_perfil_select_auth" ON public.permissoes_perfil;
CREATE POLICY "permissoes_perfil_select_auth"
  ON public.permissoes_perfil FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.permissoes_perfil (role, cargo, permissao, valor) VALUES
-- â”€â”€ Admin / adm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('admin', 'adm', 'criar_cards',        true),
('admin', 'adm', 'mover_fase',         true),
('admin', 'adm', 'arquivar_cards',     true),
('admin', 'adm', 'finalizar_cards',    true),
('admin', 'adm', 'criar_chamados',     true),
('admin', 'adm', 'ver_sirene',         true),
('admin', 'adm', 'ver_dashboard',      true),
('admin', 'adm', 'configurar_sla',     true),
('admin', 'adm', 'convidar_usuarios',  true),
('admin', 'adm', 'editar_instrucoes',  true),
('admin', 'adm', 'vincular_cards',     true),
-- â”€â”€ Admin / analista â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('admin', 'analista', 'criar_cards',        true),
('admin', 'analista', 'mover_fase',         true),
('admin', 'analista', 'arquivar_cards',     true),
('admin', 'analista', 'finalizar_cards',    true),
('admin', 'analista', 'criar_chamados',     true),
('admin', 'analista', 'ver_sirene',         true),
('admin', 'analista', 'ver_dashboard',      true),
('admin', 'analista', 'configurar_sla',     false),
('admin', 'analista', 'convidar_usuarios',  false),
('admin', 'analista', 'editar_instrucoes',  true),
('admin', 'analista', 'vincular_cards',     true),
-- â”€â”€ Admin / estagiario â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('admin', 'estagiario', 'criar_cards',        false),
('admin', 'estagiario', 'mover_fase',         false),
('admin', 'estagiario', 'arquivar_cards',     false),
('admin', 'estagiario', 'finalizar_cards',    false),
('admin', 'estagiario', 'criar_chamados',     true),
('admin', 'estagiario', 'ver_sirene',         true),
('admin', 'estagiario', 'ver_dashboard',      true),
('admin', 'estagiario', 'configurar_sla',     false),
('admin', 'estagiario', 'convidar_usuarios',  false),
('admin', 'estagiario', 'editar_instrucoes',  false),
('admin', 'estagiario', 'vincular_cards',     false),
-- â”€â”€ Team / adm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('team', 'adm', 'criar_cards',        true),
('team', 'adm', 'mover_fase',         true),
('team', 'adm', 'arquivar_cards',     true),
('team', 'adm', 'finalizar_cards',    true),
('team', 'adm', 'criar_chamados',     true),
('team', 'adm', 'ver_sirene',         true),
('team', 'adm', 'ver_dashboard',      true),
('team', 'adm', 'configurar_sla',     true),
('team', 'adm', 'convidar_usuarios',  true),
('team', 'adm', 'editar_instrucoes',  true),
('team', 'adm', 'vincular_cards',     true),
-- â”€â”€ Team / analista â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('team', 'analista', 'criar_cards',        true),
('team', 'analista', 'mover_fase',         true),
('team', 'analista', 'arquivar_cards',     false),
('team', 'analista', 'finalizar_cards',    false),
('team', 'analista', 'criar_chamados',     true),
('team', 'analista', 'ver_sirene',         true),
('team', 'analista', 'ver_dashboard',      true),
('team', 'analista', 'configurar_sla',     false),
('team', 'analista', 'convidar_usuarios',  false),
('team', 'analista', 'editar_instrucoes',  true),
('team', 'analista', 'vincular_cards',     true),
-- â”€â”€ Team / estagiario â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('team', 'estagiario', 'criar_cards',        false),
('team', 'estagiario', 'mover_fase',         false),
('team', 'estagiario', 'arquivar_cards',     false),
('team', 'estagiario', 'finalizar_cards',    false),
('team', 'estagiario', 'criar_chamados',     true),
('team', 'estagiario', 'ver_sirene',         true),
('team', 'estagiario', 'ver_dashboard',      false),
('team', 'estagiario', 'configurar_sla',     false),
('team', 'estagiario', 'convidar_usuarios',  false),
('team', 'estagiario', 'editar_instrucoes',  false),
('team', 'estagiario', 'vincular_cards',     false),
-- â”€â”€ Frank / adm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('frank', 'adm', 'criar_chamados',  true),
('frank', 'adm', 'ver_dashboard',   true),
('frank', 'adm', 'criar_cards',     false),
('frank', 'adm', 'mover_fase',      false),
('frank', 'adm', 'arquivar_cards',  false),
('frank', 'adm', 'finalizar_cards', false),
('frank', 'adm', 'ver_sirene',      false),
-- â”€â”€ Frank / analista â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('frank', 'analista', 'criar_chamados',  true),
('frank', 'analista', 'ver_dashboard',   false),
('frank', 'analista', 'criar_cards',     false),
('frank', 'analista', 'mover_fase',      false),
('frank', 'analista', 'arquivar_cards',  false),
('frank', 'analista', 'finalizar_cards', false),
('frank', 'analista', 'ver_sirene',      false),
-- â”€â”€ Frank / estagiario â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('frank', 'estagiario', 'criar_chamados', false),
('frank', 'estagiario', 'ver_dashboard',  false),
-- â”€â”€ Parceiro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('parceiro', 'adm',       'criar_chamados', true),
('parceiro', 'analista',  'criar_chamados', true),
('parceiro', 'estagiario','criar_chamados', false),
-- â”€â”€ Fornecedor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('fornecedor', 'adm',       'criar_chamados', true),
('fornecedor', 'analista',  'criar_chamados', true),
('fornecedor', 'estagiario','criar_chamados', false)
ON CONFLICT (role, cargo, permissao) DO NOTHING;

GRANT SELECT ON public.permissoes_perfil TO authenticated, anon;
-- Kanbans permitidos (Time + EstagiÃ¡rio): valores = public.kanbans.nome
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS funis_acesso TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.profiles.funis_acesso IS
  'Lista de kanbans.nome acessÃ­veis; usado para Time + estagiÃ¡rio. NULL = nÃ£o aplicÃ¡vel ou sem restriÃ§Ã£o por esta lista.';
-- ValidaÃ§Ã£o trimestral de dados (Frank) + vÃ­nculo perfil â†” rede_franqueados + RLS

-- â”€â”€â”€ 1. Tabela de validaÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.frank_validacoes_dados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frank_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  validado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (frank_id, periodo)
);

COMMENT ON TABLE public.frank_validacoes_dados IS
  'ConfirmaÃ§Ã£o trimestral de dados do franqueado (periodo ex.: 2026-01, 2026-04, 2026-07, 2026-11).';

CREATE INDEX IF NOT EXISTS idx_frank_validacoes_frank ON public.frank_validacoes_dados (frank_id);
CREATE INDEX IF NOT EXISTS idx_frank_validacoes_periodo ON public.frank_validacoes_dados (periodo);

ALTER TABLE public.frank_validacoes_dados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "frank_validacoes_select_own" ON public.frank_validacoes_dados;
CREATE POLICY "frank_validacoes_select_own"
  ON public.frank_validacoes_dados FOR SELECT TO authenticated
  USING (frank_id = auth.uid());

DROP POLICY IF EXISTS "frank_validacoes_insert_own" ON public.frank_validacoes_dados;
CREATE POLICY "frank_validacoes_insert_own"
  ON public.frank_validacoes_dados FOR INSERT TO authenticated
  WITH CHECK (frank_id = auth.uid());

DROP POLICY IF EXISTS "frank_validacoes_update_own" ON public.frank_validacoes_dados;
CREATE POLICY "frank_validacoes_update_own"
  ON public.frank_validacoes_dados FOR UPDATE TO authenticated
  USING (frank_id = auth.uid())
  WITH CHECK (frank_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.frank_validacoes_dados TO authenticated;

-- â”€â”€â”€ 2. Perfil â†’ linha da rede (cadastro portal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rede_franqueado_id UUID REFERENCES public.rede_franqueados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.rede_franqueado_id IS
  'Linha em rede_franqueados associada ao franqueado (portal).';

CREATE INDEX IF NOT EXISTS idx_profiles_rede_franqueado_id ON public.profiles (rede_franqueado_id);

-- â”€â”€â”€ 3. Frank pode atualizar a prÃ³pria linha na rede â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "rede_franqueados_update_frank_own" ON public.rede_franqueados;
CREATE POLICY "rede_franqueados_update_frank_own"
  ON public.rede_franqueados FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT p.rede_franqueado_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id IS NOT NULL
    )
  )
  WITH CHECK (
    id IN (
      SELECT p.rede_franqueado_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id IS NOT NULL
    )
  );

-- â”€â”€â”€ 4. Convites Frank: admin ou time (legado consultor â†’ team na 132) â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "convites_frank_select_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_select_admin"
  ON public.convites_frank FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_insert_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_insert_admin"
  ON public.convites_frank FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_update_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_update_admin"
  ON public.convites_frank FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );
ALTER TABLE public.rede_franqueados
  DROP COLUMN IF EXISTS data_kit_boas_vindas;
-- PARTE 1: Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('chamados-attachments', 'chamados-attachments', false, 10485760, null),
  ('subchamados-attachments', 'subchamados-attachments', false, 10485760, null),
  ('rede-attachments', 'rede-attachments', false, 10485760, null)
ON CONFLICT (id) DO NOTHING;

-- PARTE 2: Anexos de chamados
CREATE TABLE IF NOT EXISTS public.chamado_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID NOT NULL REFERENCES public.kanban_atividades(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  tamanho INTEGER,
  tipo_mime TEXT,
  uploader_id UUID REFERENCES auth.users(id),
  uploader_nome TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chamado_anexos_chamado
  ON public.chamado_anexos(chamado_id);

ALTER TABLE public.chamado_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chamado_anexos_select" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_select" ON public.chamado_anexos
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
    OR uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.kanban_atividades a
      WHERE a.id = chamado_id AND auth.uid() = ANY(COALESCE(a.responsaveis_ids, '{}'))
    )
  );

DROP POLICY IF EXISTS "chamado_anexos_insert" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_insert" ON public.chamado_anexos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "chamado_anexos_delete" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_delete" ON public.chamado_anexos
  FOR DELETE TO authenticated USING (
    uploader_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
  );

-- PARTE 3: Anexos de sub-chamados
CREATE TABLE IF NOT EXISTS public.subchamado_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subchamado_id BIGINT NOT NULL REFERENCES public.sirene_topicos(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  tamanho INTEGER,
  tipo_mime TEXT,
  uploader_id UUID REFERENCES auth.users(id),
  uploader_nome TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subchamado_anexos_subchamado
  ON public.subchamado_anexos(subchamado_id);

ALTER TABLE public.subchamado_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subchamado_anexos_select" ON public.subchamado_anexos;
CREATE POLICY "subchamado_anexos_select" ON public.subchamado_anexos
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "subchamado_anexos_insert" ON public.subchamado_anexos;
CREATE POLICY "subchamado_anexos_insert" ON public.subchamado_anexos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "subchamado_anexos_delete" ON public.subchamado_anexos;
CREATE POLICY "subchamado_anexos_delete" ON public.subchamado_anexos
  FOR DELETE TO authenticated USING (
    uploader_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
  );

-- PARTE 4: Colunas de anexos na rede de franqueados
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_cof_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_contrato_path TEXT;

COMMENT ON COLUMN public.rede_franqueados.anexo_cof_path IS
  'Caminho no bucket rede-attachments para o COF assinado';
COMMENT ON COLUMN public.rede_franqueados.anexo_contrato_path IS
  'Caminho no bucket rede-attachments para o Contrato assinado';

-- PARTE 5: Policies do storage
DROP POLICY IF EXISTS "chamados_attachments_select" ON storage.objects;
CREATE POLICY "chamados_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chamados-attachments');

DROP POLICY IF EXISTS "chamados_attachments_insert" ON storage.objects;
CREATE POLICY "chamados_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chamados-attachments');

DROP POLICY IF EXISTS "chamados_attachments_delete" ON storage.objects;
CREATE POLICY "chamados_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chamados-attachments');

DROP POLICY IF EXISTS "subchamados_attachments_all" ON storage.objects;
CREATE POLICY "subchamados_attachments_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'subchamados-attachments')
  WITH CHECK (bucket_id = 'subchamados-attachments');

DROP POLICY IF EXISTS "rede_attachments_select" ON storage.objects;
CREATE POLICY "rede_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rede-attachments');

DROP POLICY IF EXISTS "rede_attachments_insert" ON storage.objects;
CREATE POLICY "rede_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rede-attachments'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
  );

DROP POLICY IF EXISTS "rede_attachments_delete" ON storage.objects;
CREATE POLICY "rede_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'rede-attachments'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
  );
-- Frank / criador do chamado: ver anexos e inserir sÃ³ nos chamados que criou (ou admin/team/responsÃ¡vel).

DROP POLICY IF EXISTS "chamado_anexos_select" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_select" ON public.chamado_anexos
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
    OR uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.kanban_atividades a
      WHERE a.id = chamado_id AND auth.uid() = ANY(COALESCE(a.responsaveis_ids, '{}'))
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_atividades a
      WHERE a.id = chamado_id AND a.criado_por = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chamado_anexos_insert" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_insert" ON public.chamado_anexos
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
    OR EXISTS (
      SELECT 1 FROM public.kanban_atividades a
      WHERE a.id = chamado_id
        AND (
          a.criado_por = auth.uid()
          OR auth.uid() = ANY(COALESCE(a.responsaveis_ids, '{}'))
        )
    )
  );
-- Documentos sensÃ­veis da rede: sÃ³ admin/team leem no storage (Frank autenticado nÃ£o baixa).

DROP POLICY IF EXISTS "rede_attachments_select" ON storage.objects;
CREATE POLICY "rede_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rede-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );
-- Time interno pode atualizar linhas da rede (ex.: anexos COF / contrato assinado).

DROP POLICY IF EXISTS "rede_franqueados_update_team" ON public.rede_franqueados;
CREATE POLICY "rede_franqueados_update_team"
  ON public.rede_franqueados FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'team'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'team'));
-- Consultores tambÃ©m enviam documentos da rede (alinha ao UPDATE em rede_franqueados).

DROP POLICY IF EXISTS "rede_attachments_insert" ON storage.objects;
CREATE POLICY "rede_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rede-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );

DROP POLICY IF EXISTS "rede_attachments_delete" ON storage.objects;
CREATE POLICY "rede_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'rede-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );
-- Tabela de menÃ§Ãµes vinculadas a comentÃ¡rios do Sirene
CREATE TABLE chamado_mencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comentario_id BIGINT NOT NULL REFERENCES sirene_mensagens(id) ON DELETE CASCADE,
  mencionado_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chamado_id BIGINT NOT NULL REFERENCES sirene_chamados(id) ON DELETE CASCADE,
  lido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chamado_mencoes ENABLE ROW LEVEL SECURITY;

-- UsuÃ¡rio vÃª sÃ³ as prÃ³prias menÃ§Ãµes
DROP POLICY IF EXISTS "mencoes_select_proprio" ON chamado_mencoes;
CREATE POLICY "mencoes_select_proprio" ON chamado_mencoes
  FOR SELECT USING (mencionado_id = auth.uid());

-- Apenas autenticados inserem (Frank bloqueado via app, nÃ£o via RLS)
DROP POLICY IF EXISTS "mencoes_insert_autenticado" ON chamado_mencoes;
CREATE POLICY "mencoes_insert_autenticado" ON chamado_mencoes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Marcar como lido
DROP POLICY IF EXISTS "mencoes_update_proprio" ON chamado_mencoes;
CREATE POLICY "mencoes_update_proprio" ON chamado_mencoes
  FOR UPDATE USING (mencionado_id = auth.uid());

-- Ãndices
CREATE INDEX idx_mencoes_mencionado ON chamado_mencoes(mencionado_id);
CREATE INDEX idx_mencoes_comentario ON chamado_mencoes(comentario_id);
-- Estrutura padronizada para avisos (ex.: menÃ§Ã£o em comentÃ¡rio de chamado)
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS mensagem TEXT,
  ADD COLUMN IF NOT EXISTS referencia_id BIGINT REFERENCES public.sirene_chamados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sirene_notificacoes.titulo IS 'TÃ­tulo curto do aviso (UI).';
COMMENT ON COLUMN public.sirene_notificacoes.mensagem IS 'Corpo do aviso; preferir este campo em novos tipos.';
COMMENT ON COLUMN public.sirene_notificacoes.referencia_id IS 'ReferÃªncia principal (ex.: id do chamado Sirene).';

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_referencia
  ON public.sirene_notificacoes (referencia_id);
-- Checklist por card do kanban com visibilidade por responsÃ¡vel (Frank vÃª sÃ³ os prÃ³prios)

CREATE TABLE IF NOT EXISTS public.kanban_checklist_itens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  texto         TEXT        NOT NULL,
  feito         BOOLEAN     NOT NULL DEFAULT FALSE,
  responsavel_id UUID       REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kanban_checklist_card       ON public.kanban_checklist_itens (card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_checklist_responsavel ON public.kanban_checklist_itens (responsavel_id);

COMMENT ON TABLE public.kanban_checklist_itens IS
  'Itens de checklist por card do kanban; frank vÃª somente os itens em que Ã© responsÃ¡vel (RLS).';

ALTER TABLE public.kanban_checklist_itens ENABLE ROW LEVEL SECURITY;

-- Internos (nÃ£o frank/franqueado) veem todos os itens do card
DROP POLICY IF EXISTS "checklist_select_interno" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_select_interno" ON public.kanban_checklist_itens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
  );

-- Frank/franqueado vÃª somente os itens onde Ã© o responsÃ¡vel
DROP POLICY IF EXISTS "checklist_select_frank" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_select_frank" ON public.kanban_checklist_itens
  FOR SELECT USING (responsavel_id = auth.uid());

-- Apenas internos criam itens
DROP POLICY IF EXISTS "checklist_insert_interno" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_insert_interno" ON public.kanban_checklist_itens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
  );

-- Marcar feito: o prÃ³prio responsÃ¡vel OU um interno
DROP POLICY IF EXISTS "checklist_update" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_update" ON public.kanban_checklist_itens
  FOR UPDATE USING (
    responsavel_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
  );

-- Apenas internos deletam
DROP POLICY IF EXISTS "checklist_delete_interno" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_delete_interno" ON public.kanban_checklist_itens
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_checklist_itens TO authenticated;
CREATE TABLE IF NOT EXISTS public.kanban_aprovacoes_fase (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id        UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  solicitado_por UUID        NOT NULL REFERENCES auth.users(id),
  fase_destino   TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pendente'
                             CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  aprovado_por   UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kanban_aprovacoes_card   ON public.kanban_aprovacoes_fase (card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_aprovacoes_status ON public.kanban_aprovacoes_fase (status);

ALTER TABLE public.kanban_aprovacoes_fase ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aprovacoes_select" ON public.kanban_aprovacoes_fase;
CREATE POLICY "aprovacoes_select" ON public.kanban_aprovacoes_fase
  FOR SELECT USING (
    solicitado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.sirene_papeis
      WHERE user_id = auth.uid() AND papel = 'bombeiro'
    )
  );

DROP POLICY IF EXISTS "aprovacoes_insert" ON public.kanban_aprovacoes_fase;
CREATE POLICY "aprovacoes_insert" ON public.kanban_aprovacoes_fase
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "aprovacoes_update_bombeiro" ON public.kanban_aprovacoes_fase;
CREATE POLICY "aprovacoes_update_bombeiro" ON public.kanban_aprovacoes_fase
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.sirene_papeis
      WHERE user_id = auth.uid() AND papel = 'bombeiro'
    )
  );
-- Chamados internos vs visÃ­veis para Frank/franqueado (RLS SELECT).
-- Internos: visivel_frank = FALSE (default). Abertos pelo prÃ³prio Frank/franqueado: TRUE.

ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS visivel_frank BOOLEAN NOT NULL DEFAULT FALSE;

-- Retroativo: quem abriu tem role frank ou franqueado
UPDATE public.sirene_chamados sc
SET visivel_frank = TRUE
FROM public.profiles p
WHERE p.id = sc.aberto_por
  AND p.role IN ('frank', 'franqueado');

CREATE INDEX IF NOT EXISTS idx_sirene_chamados_visivel_frank
  ON public.sirene_chamados (visivel_frank)
  WHERE visivel_frank = TRUE;

-- Substitui a policy de 037: internos veem tudo; Frank/franqueado sÃ³ linhas visivel_frank.
-- MantÃ©m sirene_chamados_hdm_team_select (035) como OR adicional para times HDM.
DROP POLICY IF EXISTS "sirene_chamados_select" ON public.sirene_chamados;
CREATE POLICY "sirene_chamados_select"
  ON public.sirene_chamados FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('frank', 'franqueado')
      )
      AND visivel_frank = TRUE
    )
  );
-- 1) ReferÃªncia a card de kanban em notificaÃ§Ãµes.
--    `referencia_id` (BIGINT) continua a apontar para `sirene_chamados`; para cards usa-se UUID aqui.
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS referencia_card_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_referencia_card
  ON public.sirene_notificacoes (referencia_card_id);

COMMENT ON COLUMN public.sirene_notificacoes.referencia_card_id IS
  'Card de kanban (ex.: rejeiÃ§Ã£o de aprovaÃ§Ã£o de fase). O pedido "referencia_id" para UUID usa esta coluna.';

-- 2) Bombeiro: ler cards com aprovaÃ§Ã£o de fase pendente
DROP POLICY IF EXISTS "kanban_cards_select_bombeiro_aprov" ON public.kanban_cards;
CREATE POLICY "kanban_cards_select_bombeiro_aprov" ON public.kanban_cards
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sirene_papeis sp WHERE sp.user_id = auth.uid() AND sp.papel = 'bombeiro')
    AND EXISTS (
      SELECT 1 FROM public.kanban_aprovacoes_fase a
      WHERE a.card_id = kanban_cards.id
        AND a.status = 'pendente'
    )
  );

-- 3) Bombeiro: ver nome do Frank que solicitou a aprovaÃ§Ã£o
DROP POLICY IF EXISTS "profiles_select_bombeiro_aprov" ON public.profiles;
CREATE POLICY "profiles_select_bombeiro_aprov" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sirene_papeis sp WHERE sp.user_id = auth.uid() AND sp.papel = 'bombeiro')
    AND EXISTS (
      SELECT 1 FROM public.kanban_aprovacoes_fase a
      WHERE a.solicitado_por = profiles.id
        AND a.status = 'pendente'
    )
  );

-- 4) Bombeiro: itens de checklist (contagem) para cards com aprovaÃ§Ã£o pendente
DROP POLICY IF EXISTS "checklist_select_bombeiro_aprov" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_select_bombeiro_aprov" ON public.kanban_checklist_itens
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sirene_papeis sp WHERE sp.user_id = auth.uid() AND sp.papel = 'bombeiro')
    AND EXISTS (
      SELECT 1 FROM public.kanban_aprovacoes_fase a
      WHERE a.card_id = kanban_checklist_itens.card_id
        AND a.status = 'pendente'
    )
  );
-- Funil Step One: nova fase "Dados do Candidato" antes de "Dados da Cidade".
-- Idempotente:
--   - Se jÃ¡ existir "Dados do Candidato", nÃ£o altera nada.
--   - Se existir o nome antigo de teste "DescriÃ§Ã£o do Candidato", renomeia para "Dados do Candidato" e ajusta o slug.
--   - Caso contrÃ¡rio: incrementa ordem das fases ativas e insere a nova fase em ordem 1.

DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND ativo = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '148_stepone_fase_dados_candidato: kanban Funil Step One nÃ£o encontrado; pulando.';
  ELSIF EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND nome = 'Dados do Candidato'
  ) THEN
    RAISE NOTICE '148_stepone_fase_dados_candidato: fase jÃ¡ existe; pulando.';
  ELSIF EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND nome = 'DescriÃ§Ã£o do Candidato'
  ) THEN
    UPDATE public.kanban_fases
    SET
      nome = 'Dados do Candidato',
      slug = 'stepone_dados_candidato'
    WHERE kanban_id = v_kanban_id
      AND nome = 'DescriÃ§Ã£o do Candidato';
  ELSE
    UPDATE public.kanban_fases
    SET ordem = ordem + 1
    WHERE kanban_id = v_kanban_id
      AND ativo = true;

    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
    VALUES (
      v_kanban_id,
      'Dados do Candidato',
      'stepone_dados_candidato',
      1,
      7,
      true
    );
  END IF;
END;
$$;

-- Cards automÃ¡ticos ao inserir franqueado: primeira fase ativa (menor ordem).
CREATE OR REPLACE FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kanban_id  UUID;
  v_fase_id    UUID;
  v_titulo     TEXT;
  v_user_id    UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND ativo = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND ativo = true
  ORDER BY ordem ASC
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_titulo := CONCAT_WS(
    ' - ',
    NULLIF(TRIM(COALESCE(NEW.n_franquia,        '')), ''),
    NULLIF(TRIM(COALESCE(NEW.cidade_casa_frank,  '')), ''),
    NULLIF(TRIM(COALESCE(NEW.area_atuacao,       '')), '')
  );

  IF v_titulo IS NULL OR v_titulo = '' THEN
    v_titulo := 'Novo Franqueado';
  END IF;

  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status)
  VALUES (v_kanban_id, v_fase_id, v_user_id, v_titulo, 'ativo');

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_criar_card_funil_ao_inserir_franqueado: erro ignorado â€” %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado() IS
  'Cria automaticamente um card no kanban "Funil Step One" na primeira fase ativa (menor ordem) '
  'sempre que um novo franqueado Ã© inserido em rede_franqueados. '
  'TÃ­tulo: n_franquia - cidade_casa_frank - area_atuacao. '
  'Sem auth.uid() (backend/service role) ou sem kanban/fase cadastrado, pula silenciosamente.';
-- 149: Checklist estrutural por fase (itens configurÃ¡veis) + respostas por card
--      + bucket de templates + seed da fase "Dados do Candidato"

-- â”€â”€â”€ Itens de checklist por fase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.kanban_fase_checklist_itens (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id               UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  ordem                 INTEGER     NOT NULL DEFAULT 0,
  label                 TEXT        NOT NULL,
  tipo                  TEXT        NOT NULL DEFAULT 'texto_curto'
    CHECK (tipo IN (
      'texto_curto','texto_longo','email','telefone',
      'numero','anexo','anexo_template','checkbox'
    )),
  obrigatorio           BOOLEAN     DEFAULT TRUE,
  visivel_candidato     BOOLEAN     DEFAULT TRUE,
  template_storage_path TEXT,
  placeholder           TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fase_checklist_itens_fase ON public.kanban_fase_checklist_itens(fase_id);

ALTER TABLE public.kanban_fase_checklist_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fase_checklist_select_interno" ON public.kanban_fase_checklist_itens;
CREATE POLICY "fase_checklist_select_interno" ON public.kanban_fase_checklist_itens
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fase_checklist_admin" ON public.kanban_fase_checklist_itens;
CREATE POLICY "fase_checklist_admin" ON public.kanban_fase_checklist_itens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- â”€â”€â”€ Respostas por card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanban_fase_checklist_respostas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID        NOT NULL REFERENCES public.kanban_fase_checklist_itens(id) ON DELETE CASCADE,
  card_id        UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  valor          TEXT,
  arquivo_path   TEXT,
  preenchido_por UUID        REFERENCES auth.users(id),
  preenchido_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_fase_checklist_respostas_card ON public.kanban_fase_checklist_respostas(card_id);
CREATE INDEX IF NOT EXISTS idx_fase_checklist_respostas_item ON public.kanban_fase_checklist_respostas(item_id);

ALTER TABLE public.kanban_fase_checklist_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fase_checklist_resp_select" ON public.kanban_fase_checklist_respostas;
CREATE POLICY "fase_checklist_resp_select" ON public.kanban_fase_checklist_respostas
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fase_checklist_resp_upsert" ON public.kanban_fase_checklist_respostas;
CREATE POLICY "fase_checklist_resp_upsert" ON public.kanban_fase_checklist_respostas
  FOR ALL USING (auth.role() = 'authenticated');

-- â”€â”€â”€ Bucket de templates de documentos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-templates', 'documentos-templates', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "templates_select_auth" ON storage.objects;
CREATE POLICY "templates_select_auth" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documentos-templates');

DROP POLICY IF EXISTS "templates_insert_admin" ON storage.objects;
CREATE POLICY "templates_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-templates'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- â”€â”€â”€ Seed: fase "Dados do Candidato" â€” SLA, instruÃ§Ãµes e itens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id   UUID;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans WHERE nome = 'Funil Step One' LIMIT 1;
  SELECT id INTO v_fase_id   FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND nome = 'Dados do Candidato' LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '149: fase "Dados do Candidato" nÃ£o encontrada; pulando seed.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases SET sla_dias = 1 WHERE id = v_fase_id;

  UPDATE public.kanban_fases SET instrucoes =
    '1. Preencher itens abaixo
2. Baixar documentos
3. Assinar documentos
4. Subir documentos assinados'
  WHERE id = v_fase_id;

  INSERT INTO public.kanban_fase_checklist_itens
    (fase_id, ordem, label, tipo, visivel_candidato, placeholder)
  SELECT * FROM (VALUES
    (v_fase_id,  1, 'Nome',                                          'texto_curto',   true,  'Nome completo'),
    (v_fase_id,  2, 'E-mail',                                        'email',         false, 'seu@email.com'),
    (v_fase_id,  3, 'Telefone',                                      'telefone',      false, '(11) 99999-9999'),
    (v_fase_id,  4, 'Idade',                                         'numero',        true,  'Ex: 35'),
    (v_fase_id,  5, 'ProfissÃ£o',                                     'texto_curto',   true,  ''),
    (v_fase_id,  6, 'ExperiÃªncias profissionais relevantes',         'texto_longo',   true,  ''),
    (v_fase_id,  7, 'TrajetÃ³ria e aprendizados mais importantes',    'texto_longo',   true,  ''),
    (v_fase_id,  8, 'Por que acredita que seria um bom franqueado MonÃ­', 'texto_longo', true, ''),
    (v_fase_id,  9, 'Termo de Confidencialidade e NÃ£o-DivulgaÃ§Ã£o',   'anexo_template', true, ''),
    (v_fase_id, 10, 'Termo de AutorizaÃ§Ã£o para Consulta de InformaÃ§Ãµes', 'anexo_template', true, '')
  ) AS t(fase_id, ordem, label, tipo, visivel_candidato, placeholder)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens WHERE fase_id = v_fase_id
  );
END $$;
-- 150: Tokens de formulÃ¡rio pÃºblico para candidatos (por card + fase)

CREATE TABLE IF NOT EXISTS public.kanban_card_form_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_id    UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  usado_em   TIMESTAMPTZ,
  created_by UUID        REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_form_tokens_card  ON public.kanban_card_form_tokens(card_id);
CREATE INDEX IF NOT EXISTS idx_card_form_tokens_token ON public.kanban_card_form_tokens(token);

ALTER TABLE public.kanban_card_form_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_tokens_select_interno" ON public.kanban_card_form_tokens;
CREATE POLICY "form_tokens_select_interno" ON public.kanban_card_form_tokens
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "form_tokens_insert_interno" ON public.kanban_card_form_tokens;
CREATE POLICY "form_tokens_insert_interno" ON public.kanban_card_form_tokens
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON public.kanban_card_form_tokens TO authenticated;

NOTIFY pgrst, 'reload schema';
