-- â”€â”€â”€ 106: Trigger â€” criar card no Funil Step One ao inserir franqueado â”€â”€â”€â”€â”€â”€â”€â”€
-- Dispara AFTER INSERT em rede_franqueados.
-- Busca o kanban "Funil Step One" e a fase "Dados da Cidade" dinamicamente.
-- TÃ­tulo do card: n_franquia - cidade_casa_frank - area_atuacao (partes nulas omitidas).
-- franqueado_id = auth.uid() (quem inseriu); se NULL (backend/service role) pula criaÃ§Ã£o.
-- Tratamento de erro via EXCEPTION: falhas nunca bloqueiam o INSERT do franqueado.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. FunÃ§Ã£o do trigger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  -- â”€â”€ UsuÃ¡rio que disparou o INSERT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  -- auth.uid() retorna NULL quando chamado via service role (backend).
  -- Neste caso nÃ£o temos um dono vÃ¡lido para o card; pulamos silenciosamente.
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- â”€â”€ Localiza o kanban "Funil Step One" â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND ativo = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RETURN NEW; -- kanban inexistente: nÃ£o bloqueia
  END IF;

  -- â”€â”€ Localiza a fase "Dados da Cidade" (fase 1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND nome = 'Dados da Cidade'
    AND ativo = true
  LIMIT 1;

  -- Fallback: se a fase nÃ£o existir pelo nome, pega a primeira fase ativa
  IF v_fase_id IS NULL THEN
    SELECT id INTO v_fase_id
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND ativo = true
    ORDER BY ordem ASC
    LIMIT 1;
  END IF;

  IF v_fase_id IS NULL THEN
    RETURN NEW; -- nenhuma fase disponÃ­vel: nÃ£o bloqueia
  END IF;

  -- â”€â”€ Monta o tÃ­tulo: FK0001 - Cidade - Ãrea â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  -- CONCAT_WS ignora NULLs automaticamente; convertemos strings vazias em NULL
  -- para que partes ausentes nÃ£o gerem " -  - " no tÃ­tulo.
  v_titulo := CONCAT_WS(
    ' - ',
    NULLIF(TRIM(COALESCE(NEW.n_franquia,        '')), ''),
    NULLIF(TRIM(COALESCE(NEW.cidade_casa_frank,  '')), ''),
    NULLIF(TRIM(COALESCE(NEW.area_atuacao,       '')), '')
  );

  -- Se todos os trÃªs campos estavam vazios, usa fallback legÃ­vel
  IF v_titulo IS NULL OR v_titulo = '' THEN
    v_titulo := 'Novo Franqueado';
  END IF;

  -- â”€â”€ Insere o card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status)
  VALUES (v_kanban_id, v_fase_id, v_user_id, v_titulo, 'ativo');

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Qualquer erro inesperado (FK violada, lock timeout, etc.) nÃ£o deve
    -- impedir o INSERT principal na rede_franqueados.
    RAISE WARNING 'fn_criar_card_funil_ao_inserir_franqueado: erro ignorado â€” %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado() IS
  'Cria automaticamente um card no kanban "Funil Step One" / fase "Dados da Cidade" '
  'sempre que um novo franqueado Ã© inserido em rede_franqueados. '
  'TÃ­tulo: n_franquia - cidade_casa_frank - area_atuacao. '
  'Sem auth.uid() (backend/service role) ou sem kanban/fase cadastrado, pula silenciosamente.';

-- â”€â”€â”€ 2. Trigger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP TRIGGER IF EXISTS trg_rede_franqueados_criar_card_funil ON public.rede_franqueados;

CREATE TRIGGER trg_rede_franqueados_criar_card_funil
  AFTER INSERT ON public.rede_franqueados
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado();

COMMENT ON TRIGGER trg_rede_franqueados_criar_card_funil ON public.rede_franqueados IS
  'ApÃ³s INSERT em rede_franqueados: cria card no Funil Step One (fase Dados da Cidade).';
-- â”€â”€â”€ 107: InteraÃ§Ãµes â€” tipo + multi-times em kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. Cria tabela kanban_times (UUID + nome) semeada com times existentes.
-- 2. Adiciona coluna tipo Ã  kanban_atividades (atividade | duvida).
-- 3. Adiciona coluna times_ids UUID[] Ã  kanban_atividades (multi-times).
--    A coluna time TEXT legada Ã© mantida para compatibilidade retroativa.
-- 4. Recria v_atividades_unificadas com tipo, times_ids e times_nomes.
-- Idempotente: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. Tabela kanban_times â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanban_times (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome  TEXT NOT NULL,
  UNIQUE (nome)
);

COMMENT ON TABLE public.kanban_times IS
  'Times/equipes disponÃ­veis para atribuiÃ§Ã£o em kanban_atividades. '
  'Semeado a partir dos team_name distintos em team_members.';

-- Seed: popula com todos os times jÃ¡ cadastrados em team_members
INSERT INTO public.kanban_times (nome)
SELECT DISTINCT team_name
FROM   public.team_members
ORDER  BY team_name
ON CONFLICT (nome) DO NOTHING;

-- RLS
ALTER TABLE public.kanban_times ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_times_select" ON public.kanban_times;
CREATE POLICY "kanban_times_select"
  ON public.kanban_times FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "kanban_times_admin" ON public.kanban_times;
CREATE POLICY "kanban_times_admin"
  ON public.kanban_times FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

GRANT SELECT ON public.kanban_times TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.kanban_times TO authenticated;

-- â”€â”€â”€ 2. Novas colunas em kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- 2a. tipo: classifica a interaÃ§Ã£o como atividade (tarefa) ou dÃºvida
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'atividade'
    CHECK (tipo IN ('atividade', 'duvida'));

COMMENT ON COLUMN public.kanban_atividades.tipo IS
  'Tipo da interaÃ§Ã£o: atividade (tarefa) | duvida.';

-- 2b. times_ids: array de UUIDs referenciando kanban_times
--     Complementa a coluna legada "time TEXT" â€” ambas coexistem.
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS times_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN public.kanban_atividades.times_ids IS
  'Times responsÃ¡veis pela atividade (array de kanban_times.id). '
  'Substitui progressivamente a coluna legada "time TEXT".';

-- Ãndice GIN para buscas eficientes dentro do array
CREATE INDEX IF NOT EXISTS idx_kanban_atividades_times_ids
  ON public.kanban_atividades USING GIN (times_ids);

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_tipo
  ON public.kanban_atividades (tipo);

-- â”€â”€â”€ 3. View v_atividades_unificadas (recriaÃ§Ã£o completa) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP VIEW IF EXISTS public.v_atividades_unificadas;

CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  -- Identificadores
  a.id,
  a.card_id,

  -- Contexto do card
  c.titulo                                              AS card_titulo,
  f.nome                                                AS fase_nome,
  k.nome                                                AS kanban_nome,

  -- ResponsÃ¡vel
  a.responsavel_id,
  COALESCE(p.full_name, p.email)                        AS responsavel_nome,

  -- Tipo da interaÃ§Ã£o (atividade | duvida)
  a.tipo,

  -- ConteÃºdo
  a.descricao,

  -- Times (IDs + nomes resolvidos)
  a.times_ids,
  ARRAY(
    SELECT t.nome
    FROM   public.kanban_times t
    WHERE  t.id = ANY(a.times_ids)
    ORDER  BY t.nome
  )                                                     AS times_nomes,

  -- Timestamp
  a.created_at                                          AS criado_em,

  -- SLA calculado a partir de data_vencimento da prÃ³pria atividade
  CASE
    WHEN a.data_vencimento IS NULL        THEN NULL
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::TEXT                                             AS sla_status

FROM public.kanban_atividades  a
JOIN public.kanban_cards        c ON c.id = a.card_id
JOIN public.kanban_fases        f ON f.id = c.fase_id
JOIN public.kanbans             k ON k.id = c.kanban_id
LEFT JOIN public.profiles       p ON p.id = a.responsavel_id;

COMMENT ON VIEW public.v_atividades_unificadas IS
  'VisÃ£o unificada de todas as atividades dos kanbans. '
  'Inclui contexto de card/fase/kanban, tipo (atividade|duvida), '
  'times_ids (array de UUIDs) e times_nomes (array de nomes resolvidos). '
  'sla_status: atrasado | vence_hoje | ok | null (sem prazo). '
  'security_invoker=true: RLS das tabelas subjacentes Ã© aplicado ao chamador.';

-- GRANT â€” autenticados podem consultar (RLS das tabelas base filtra o resultado)
GRANT SELECT ON public.v_atividades_unificadas TO authenticated;
-- â”€â”€â”€ 108: kanban_historico + triggers automÃ¡ticos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Tabela de auditoria de cards: registra mudanÃ§as de fase e interaÃ§Ãµes.
-- Triggers SECURITY DEFINER garantem escrita mesmo com RLS ativo.
-- RLS SELECT: usuÃ¡rio sÃ³ vÃª histÃ³rico de cards aos quais tem acesso.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. Tabela kanban_historico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  'Log de auditoria de cards do kanban: mudanÃ§as de fase e interaÃ§Ãµes. '
  'Populado exclusivamente via triggers â€” nunca inserir manualmente.';

-- â”€â”€â”€ 2. RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_historico ENABLE ROW LEVEL SECURITY;

-- SELECT: usuÃ¡rio vÃª histÃ³rico dos cards que jÃ¡ tem acesso
-- (replica a lÃ³gica de kanban_cards_select sem criar dependÃªncia circular)
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

-- â”€â”€â”€ 3. Helper: resolve nome do usuÃ¡rio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Usada pelas funÃ§Ãµes de trigger para desnormalizar usuario_nome.
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

-- â”€â”€â”€ 4a. Trigger: mudanÃ§a de fase em kanban_cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Dispara AFTER UPDATE quando fase_id muda.
-- Compara kanban_fases.ordem para decidir se Ã© avanÃ§o ou retrocesso.

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
  -- Sem mudanÃ§a efetiva de fase: nada a registrar
  IF OLD.fase_id IS NOT DISTINCT FROM NEW.fase_id THEN
    RETURN NEW;
  END IF;

  -- Busca metadados das fases
  SELECT ordem, nome INTO v_ordem_antiga, v_nome_antiga
  FROM public.kanban_fases WHERE id = OLD.fase_id;

  SELECT ordem, nome INTO v_ordem_nova, v_nome_nova
  FROM public.kanban_fases WHERE id = NEW.fase_id;

  -- Determina direÃ§Ã£o do movimento
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
    RAISE WARNING 'fn_historico_fase_alterada: erro ignorado â€” %', SQLERRM;
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
  'DireÃ§Ã£o determinada comparando kanban_fases.ordem das fases anterior e nova.';

-- â”€â”€â”€ 4b. Trigger: nova interaÃ§Ã£o em kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    RAISE WARNING 'fn_historico_interacao_criada: erro ignorado â€” %', SQLERRM;
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

-- â”€â”€â”€ 4c. Trigger: ediÃ§Ã£o de interaÃ§Ã£o em kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    RAISE WARNING 'fn_historico_interacao_editada: erro ignorado â€” %', SQLERRM;
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
-- â”€â”€â”€ 109: ComentÃ¡rios por card do kanban (funil) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Agrega comentÃ¡rios do card; fase_id opcional (contexto ao publicar).

CREATE TABLE IF NOT EXISTS public.kanban_card_comentarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_id    UUID        REFERENCES public.kanban_fases(id) ON DELETE SET NULL,
  autor_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  texto      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_card_comentarios_card
  ON public.kanban_card_comentarios (card_id);

CREATE INDEX IF NOT EXISTS idx_kanban_card_comentarios_created
  ON public.kanban_card_comentarios (created_at DESC);

COMMENT ON TABLE public.kanban_card_comentarios IS
  'ComentÃ¡rios do card no kanban; listagem agrega todas as fases.';

ALTER TABLE public.kanban_card_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_card_comentarios_select" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_select"
  ON public.kanban_card_comentarios FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = kanban_card_comentarios.card_id));

DROP POLICY IF EXISTS "kanban_card_comentarios_insert" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_insert"
  ON public.kanban_card_comentarios FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = kanban_card_comentarios.card_id)
  );

GRANT SELECT, INSERT ON public.kanban_card_comentarios TO authenticated;
-- â”€â”€â”€ 110: v_atividades_unificadas â€” merge 106 + 107 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Garante colunas usadas pelo app (titulo, status, prazo, kanban_id, franqueado,
-- time legado) junto com tipo, times_ids e times_nomes da 107.

DROP VIEW IF EXISTS public.v_atividades_unificadas;

CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.card_id,

  c.titulo                                              AS card_titulo,
  f.nome                                                AS fase_nome,
  k.nome                                                AS kanban_nome,
  k.id                                                  AS kanban_id,

  a.responsavel_id,
  COALESCE(p.full_name, p.email)                        AS responsavel_nome,

  a.tipo,

  COALESCE(NULLIF(trim(a.titulo), ''), NULLIF(trim(a.descricao), ''), '(sem tÃ­tulo)') AS titulo,
  a.descricao,

  a.status                                              AS atividade_status,
  a.data_vencimento,
  a.time                                                AS time_nome,
  a.times_ids,
  ARRAY(
    SELECT t.nome
    FROM   public.kanban_times t
    WHERE  t.id = ANY(a.times_ids)
    ORDER  BY t.nome
  )                                                     AS times_nomes,

  COALESCE(fp.full_name, fp.email)                      AS franqueado_nome,

  a.created_at                                          AS criado_em,

  CASE
    WHEN a.data_vencimento IS NULL        THEN NULL
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::TEXT                                             AS sla_status

FROM public.kanban_atividades  a
JOIN public.kanban_cards        c ON c.id = a.card_id
JOIN public.kanban_fases        f ON f.id = c.fase_id
JOIN public.kanbans             k ON k.id = c.kanban_id
LEFT JOIN public.profiles       p ON p.id = a.responsavel_id
LEFT JOIN public.profiles       fp ON fp.id = c.franqueado_id;

COMMENT ON VIEW public.v_atividades_unificadas IS
  'VisÃ£o unificada de interaÃ§Ãµes (kanban_atividades): card, fase, kanban, '
  'responsÃ¡vel, tipo (atividade|duvida), conteÃºdo, SLA por data_vencimento, '
  'times multi (times_nomes) e time legado, franqueado do card.';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated;
-- â”€â”€â”€ 111: Registrar todos os kanbans do sistema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. Adiciona coluna descricao Ã  tabela kanbans (sem quebrar dados existentes).
-- 2. Remove duplicatas de nome antes de criar a constraint UNIQUE.
-- 3. Adiciona UNIQUE (nome) idempotentemente.
-- 4. Insere os 5 kanbans canÃ´nicos via ON CONFLICT (nome) DO NOTHING.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. Coluna descricao â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanbans
  ADD COLUMN IF NOT EXISTS descricao TEXT;

COMMENT ON COLUMN public.kanbans.descricao IS
  'DescriÃ§Ã£o resumida do propÃ³sito do kanban.';

-- â”€â”€â”€ 2. Remover duplicatas por nome â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- MantÃ©m apenas a linha mais antiga (menor ctid) de cada nome.
-- Seguro mesmo se nÃ£o houver duplicatas.
DELETE FROM public.kanbans
WHERE ctid NOT IN (
  SELECT min(ctid)
  FROM   public.kanbans
  GROUP  BY nome
);

-- â”€â”€â”€ 3. UNIQUE (nome) idempotente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname      = 'kanbans_nome_unique'
      AND  conrelid     = 'public.kanbans'::REGCLASS
  ) THEN
    ALTER TABLE public.kanbans
      ADD CONSTRAINT kanbans_nome_unique UNIQUE (nome);
  END IF;
END;
$$;

-- â”€â”€â”€ 4. Seed: 5 kanbans canÃ´nicos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanbans (nome, descricao, ordem, ativo) VALUES
  ('Funil Step One', 'Funil de viabilidade de novas franquias',  1, true),
  ('Portfolio',      'GestÃ£o de portfolio de franquias',          2, true),
  ('OperaÃ§Ãµes',      'GestÃ£o operacional de franquias',           3, true),
  ('Contabilidade',  'GestÃ£o contÃ¡bil de franquias',              4, true),
  ('CrÃ©dito',        'GestÃ£o de crÃ©dito de franquias',            5, true)
ON CONFLICT (nome) DO UPDATE
  SET descricao = EXCLUDED.descricao,
      ativo     = true
  WHERE public.kanbans.descricao IS NULL;

COMMENT ON TABLE public.kanbans IS
  'Boards de kanban do Hub Fly. '
  'Kanbans canÃ´nicos: Funil Step One, Portfolio, OperaÃ§Ãµes, Contabilidade, CrÃ©dito.';
-- Migration 112: Views de compatibilidade legado
-- Objetivo: fazer o frontend novo (KanbanBoard/KanbanCardModal) ler dados reais
-- de processo_step_one sem mover nem apagar nada.
-- ATENÃ‡ÃƒO: Requer migration 111 jÃ¡ aplicada antes de rodar esta.

-- ============================================================
-- PARTE 0: Adicionar coluna slug em kanban_fases
-- ============================================================
-- Nullable para nÃ£o quebrar as 7 fases existentes do Funil Step One.
-- O Ã­ndice Ãºnico parcial (WHERE slug IS NOT NULL) garante idempotÃªncia
-- nos INSERTs abaixo sem afetar fases sem slug.

ALTER TABLE public.kanban_fases
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_fases_kanban_slug
  ON public.kanban_fases (kanban_id, slug)
  WHERE slug IS NOT NULL;

-- ============================================================
-- PARTE 1: Registrar fases reais nos kanbans legados em kanban_fases
-- ============================================================

-- Contabilidade (3 fases)
INSERT INTO kanban_fases (kanban_id, nome, slug, ordem)
SELECT k.id, fase.nome, fase.slug, fase.ordem
FROM kanbans k
CROSS JOIN (VALUES
  ('Incorporadora', 'contabilidade_incorporadora', 1),
  ('SPE', 'contabilidade_spe', 2),
  ('Gestora', 'contabilidade_gestora', 3)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'Contabilidade'
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

-- CrÃ©dito (2 fases)
INSERT INTO kanban_fases (kanban_id, nome, slug, ordem)
SELECT k.id, fase.nome, fase.slug, fase.ordem
FROM kanbans k
CROSS JOIN (VALUES
  ('CrÃ©dito Terreno', 'credito_terreno', 1),
  ('CrÃ©dito Obra', 'credito_obra', 2)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'CrÃ©dito'
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

-- Portfolio + OperaÃ§Ãµes (19 fases de PAINEL_COLUMNS)
INSERT INTO kanban_fases (kanban_id, nome, slug, ordem)
SELECT k.id, fase.nome, fase.slug, fase.ordem
FROM kanbans k
CROSS JOIN (VALUES
  ('Dados do NegÃ³cio',       'step_2',                    1),
  ('AprovaÃ§Ã£o MonÃ­',         'aprovacao_moni_novo_negocio',2),
  ('DocumentaÃ§Ã£o',           'step_3',                    3),
  ('Acoplamento',            'acoplamento',               4),
  ('Step 4',                 'step_4',                    5),
  ('Step 5',                 'step_5',                    6),
  ('Step 6',                 'step_6',                    7),
  ('Step 7',                 'step_7',                    8),
  ('Passagem Wayser',        'passagem_wayser',           9),
  ('PlanialtimÃ©trico',       'planialtimetrico',          10),
  ('Sondagem',               'sondagem',                  11),
  ('Projeto Legal',          'projeto_legal',             12),
  ('AprovaÃ§Ã£o CondomÃ­nio',   'aprovacao_condominio',      13),
  ('AprovaÃ§Ã£o Prefeitura',   'aprovacao_prefeitura',      14),
  ('RevisÃ£o BCA',            'revisao_bca',               15),
  ('Processos CartorÃ¡rios',  'processos_cartorarios',     16),
  ('Aguardando CrÃ©dito',     'aguardando_credito',        17),
  ('Em Obra',                'em_obra',                   18),
  ('Moni Care',              'moni_care',                 19)
) AS fase(nome, slug, ordem)
WHERE k.nome IN ('Portfolio', 'OperaÃ§Ãµes')
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

-- ============================================================
-- PARTE 2: VIEW de compatibilidade processo_step_one â†’ formato kanban_cards
-- ============================================================

CREATE OR REPLACE VIEW public.v_processo_como_kanban_cards AS
SELECT
  p.id,
  kf.kanban_id,
  kf.id          AS fase_id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' - ', p.numero_franquia, p.nome_condominio)), ''),
    'Sem tÃ­tulo'
  )              AS titulo,
  p.status,
  p.created_at   AS criado_em,
  p.updated_at,
  p.user_id      AS responsavel_id,
  p.etapa_painel AS etapa_slug,
  NULL::date     AS data_prazo_sla,
  'legado'       AS origem
FROM processo_step_one p
JOIN kanban_fases kf ON kf.slug = p.etapa_painel
JOIN kanbans k       ON k.id   = kf.kanban_id
WHERE k.nome IN ('Portfolio', 'OperaÃ§Ãµes', 'Contabilidade', 'CrÃ©dito')
  AND p.cancelado_em IS NULL
  AND p.removido_em  IS NULL;

GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;

-- ============================================================
-- VerificaÃ§Ã£o: quantos registros por kanban
-- ============================================================
SELECT k.nome, COUNT(*)
FROM v_processo_como_kanban_cards v
JOIN kanbans k ON k.id = v.kanban_id
GROUP BY k.nome;
GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;
GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;
-- Migration 114: Renomear kanbans, aparar fases e corrigir nomes de fases
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1: Renomear kanbans
-- ============================================================

UPDATE public.kanbans SET nome = 'Funil PortfÃ³lio'    WHERE nome = 'Portfolio';
UPDATE public.kanbans SET nome = 'Funil OperaÃ§Ãµes'    WHERE nome = 'OperaÃ§Ãµes';
UPDATE public.kanbans SET nome = 'Funil Contabilidade' WHERE nome = 'Contabilidade';
UPDATE public.kanbans SET nome = 'Funil CrÃ©dito'      WHERE nome = 'CrÃ©dito';

-- ============================================================
-- PARTE 2: Funil PortfÃ³lio â€” remover fases a partir de PlanialtimÃ©trico
-- (manter apenas step_2 â†’ passagem_wayser inclusive)
-- ============================================================

DELETE FROM public.kanban_fases
WHERE slug IN (
  'planialtimetrico', 'sondagem', 'projeto_legal',
  'aprovacao_condominio', 'aprovacao_prefeitura',
  'revisao_bca', 'processos_cartorarios',
  'aguardando_credito', 'em_obra', 'moni_care'
)
AND kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil PortfÃ³lio');

-- ============================================================
-- PARTE 3: Funil OperaÃ§Ãµes â€” remover fases atÃ© Passagem Wayser
-- (manter apenas planialtimetrico â†’ moni_care inclusive)
-- ============================================================

DELETE FROM public.kanban_fases
WHERE slug IN (
  'step_2', 'aprovacao_moni_novo_negocio', 'step_3', 'acoplamento',
  'step_4', 'step_5', 'step_6', 'step_7', 'passagem_wayser'
)
AND kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil OperaÃ§Ãµes');

-- ============================================================
-- PARTE 4: Corrigir nomes de fases (nomes exatos de painelColumns.ts)
-- ============================================================

-- Funil PortfÃ³lio
UPDATE public.kanban_fases SET nome = 'Step 2: Novo NegÃ³cio'                     WHERE slug = 'step_2';
UPDATE public.kanban_fases SET nome = 'AprovaÃ§Ã£o MonÃ­ - Novo NegÃ³cio'            WHERE slug = 'aprovacao_moni_novo_negocio';
UPDATE public.kanban_fases SET nome = 'Step 3: OpÃ§Ã£o'                            WHERE slug = 'step_3';
UPDATE public.kanban_fases SET nome = 'Step 4: Check Legal + Checklist de CrÃ©dito' WHERE slug = 'step_4';
-- 'acoplamento' â†’ 'Acoplamento' (jÃ¡ estÃ¡ correto)
UPDATE public.kanban_fases SET nome = 'Step 5: ComitÃª'                           WHERE slug = 'step_5';
UPDATE public.kanban_fases SET nome = 'Step 6: DiligÃªncia'                       WHERE slug = 'step_6';
UPDATE public.kanban_fases SET nome = 'Step 7: Contrato'                         WHERE slug = 'step_7';
UPDATE public.kanban_fases SET nome = 'Passagem para Wayser'                     WHERE slug = 'passagem_wayser';

-- Funil OperaÃ§Ãµes
-- 'planialtimetrico' â†’ 'PlanialtimÃ©trico' (jÃ¡ estÃ¡ correto)
UPDATE public.kanban_fases SET nome = 'Sondagem (paralelo PlanialtimÃ©trico)'     WHERE slug = 'sondagem';
-- 'projeto_legal' â†’ 'Projeto Legal' (jÃ¡ estÃ¡ correto)
UPDATE public.kanban_fases SET nome = 'AprovaÃ§Ã£o no CondomÃ­nio'                  WHERE slug = 'aprovacao_condominio';
UPDATE public.kanban_fases SET nome = 'AprovaÃ§Ã£o na Prefeitura'                  WHERE slug = 'aprovacao_prefeitura';
UPDATE public.kanban_fases SET nome = 'RevisÃ£o do BCA'                           WHERE slug = 'revisao_bca';
-- 'processos_cartorarios' â†’ 'Processos CartorÃ¡rios' (jÃ¡ estÃ¡ correto)
-- 'aguardando_credito' â†’ 'Aguardando CrÃ©dito' (jÃ¡ estÃ¡ correto)
-- 'em_obra' â†’ 'Em Obra' (jÃ¡ estÃ¡ correto)
UPDATE public.kanban_fases SET nome = 'MonÃ­ Care'                                WHERE slug = 'moni_care';

-- Funil Contabilidade
UPDATE public.kanban_fases SET nome = 'Abertura da Incorporadora'                WHERE slug = 'contabilidade_incorporadora';
UPDATE public.kanban_fases SET nome = 'Abertura da SPE'                          WHERE slug = 'contabilidade_spe';
UPDATE public.kanban_fases SET nome = 'Abertura da Gestora'                      WHERE slug = 'contabilidade_gestora';

-- Funil CrÃ©dito: 'CrÃ©dito Terreno' e 'CrÃ©dito Obra' jÃ¡ estÃ£o corretos

-- ============================================================
-- PARTE 5: Atualizar a view para usar os novos nomes dos kanbans
-- ============================================================

CREATE OR REPLACE VIEW public.v_processo_como_kanban_cards AS
SELECT
  p.id,
  kf.kanban_id,
  kf.id          AS fase_id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' - ', p.numero_franquia, p.nome_condominio)), ''),
    'Sem tÃ­tulo'
  )              AS titulo,
  p.status,
  p.created_at   AS criado_em,
  p.updated_at,
  p.user_id      AS responsavel_id,
  p.etapa_painel AS etapa_slug,
  NULL::date     AS data_prazo_sla,
  'legado'       AS origem
FROM processo_step_one p
JOIN kanban_fases kf ON kf.slug = p.etapa_painel
JOIN kanbans k       ON k.id   = kf.kanban_id
WHERE k.nome IN ('Funil PortfÃ³lio', 'Funil OperaÃ§Ãµes', 'Funil Contabilidade', 'Funil CrÃ©dito')
  AND p.cancelado_em IS NULL
  AND p.removido_em  IS NULL;

GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;

-- ============================================================
-- VerificaÃ§Ã£o: kanbans e contagem de fases
-- ============================================================
SELECT k.nome, COUNT(kf.id) AS total_fases
FROM public.kanbans k
LEFT JOIN public.kanban_fases kf ON kf.kanban_id = k.id
GROUP BY k.nome
ORDER BY k.nome;
UPDATE public.kanban_fases
SET sla_dias = 7
WHERE kanban_id IN (
  SELECT id FROM public.kanbans
  WHERE nome IN ('Funil PortfÃ³lio', 'Funil OperaÃ§Ãµes', 'Funil Contabilidade', 'Funil CrÃ©dito')
)
AND sla_dias IS NULL;
-- â”€â”€â”€ 116: FK suporte a cards legados (processo_step_one) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Problema: kanban_historico, kanban_atividades e kanban_card_comentarios
-- referenciavam kanban_cards(id), mas cards legados usam UUID de processo_step_one.
-- SoluÃ§Ã£o: remover FKs de card_id; em atividades, coluna origem nativo|legado.
-- Atualiza RLS e recria v_atividades_unificadas (compatÃ­vel com migration 110 + app).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 0 â€” View depende de kanban_atividades; derrubar antes
-- ============================================================
DROP VIEW IF EXISTS public.v_atividades_unificadas;

-- ============================================================
-- PARTE 1 â€” kanban_atividades
-- ============================================================
ALTER TABLE public.kanban_atividades
  DROP CONSTRAINT IF EXISTS kanban_atividades_card_id_fkey;

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS origem TEXT;

UPDATE public.kanban_atividades
SET origem = 'nativo'
WHERE origem IS NULL;

ALTER TABLE public.kanban_atividades
  ALTER COLUMN origem SET DEFAULT 'nativo';

ALTER TABLE public.kanban_atividades
  DROP CONSTRAINT IF EXISTS kanban_atividades_origem_check;

ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_origem_check
  CHECK (origem IN ('nativo', 'legado'));

ALTER TABLE public.kanban_atividades
  ALTER COLUMN origem SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_card_id
  ON public.kanban_atividades (card_id);

COMMENT ON COLUMN public.kanban_atividades.origem IS
  'nativo: card_id em kanban_cards. legado: card_id = processo_step_one.id.';

-- RLS: mesma regra de cards + processo dono (frank) ou jÃ¡ coberto por admin/consultor
DROP POLICY IF EXISTS kanban_atividades_select ON public.kanban_atividades;
CREATE POLICY kanban_atividades_select ON public.kanban_atividades
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS kanban_atividades_insert ON public.kanban_atividades;
CREATE POLICY kanban_atividades_insert ON public.kanban_atividades
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS kanban_atividades_update ON public.kanban_atividades;
CREATE POLICY kanban_atividades_update ON public.kanban_atividades
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS kanban_atividades_delete ON public.kanban_atividades;
CREATE POLICY kanban_atividades_delete ON public.kanban_atividades
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- PARTE 2 â€” kanban_historico
-- ============================================================
ALTER TABLE public.kanban_historico
  DROP CONSTRAINT IF EXISTS kanban_historico_card_id_fkey;

CREATE INDEX IF NOT EXISTS idx_kanban_historico_card_id
  ON public.kanban_historico (card_id);

DROP POLICY IF EXISTS "kanban_historico_select" ON public.kanban_historico;
CREATE POLICY "kanban_historico_select"
  ON public.kanban_historico FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN ('admin', 'consultor')
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

-- ============================================================
-- PARTE 3 â€” kanban_card_comentarios
-- ============================================================
ALTER TABLE public.kanban_card_comentarios
  DROP CONSTRAINT IF EXISTS kanban_card_comentarios_card_id_fkey;

CREATE INDEX IF NOT EXISTS idx_kanban_card_comentarios_card_id
  ON public.kanban_card_comentarios (card_id);

DROP POLICY IF EXISTS "kanban_card_comentarios_select" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_select"
  ON public.kanban_card_comentarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards c
      WHERE c.id = kanban_card_comentarios.card_id
    )
    OR EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = kanban_card_comentarios.card_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles pr
            WHERE pr.id = auth.uid()
              AND pr.role IN ('admin', 'consultor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "kanban_card_comentarios_insert" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_insert"
  ON public.kanban_card_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.kanban_cards c
        WHERE c.id = kanban_card_comentarios.card_id
      )
      OR EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_card_comentarios.card_id
          AND (
            p.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.profiles pr
              WHERE pr.id = auth.uid()
                AND pr.role IN ('admin', 'consultor')
            )
          )
      )
    )
  );

-- ============================================================
-- PARTE 4 â€” v_atividades_unificadas (nativo + legado)
-- Colunas alinhadas Ã  migration 110 (app / card-actions).
-- sla_status: NULL sem prazo (filtro "sem_prazo" no painel).
-- ============================================================
CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.card_id,

  COALESCE(kc.titulo, vmap.titulo, '(sem tÃ­tulo)') AS card_titulo,

  COALESCE(kf.nome, '') AS fase_nome,

  COALESCE(k.nome, '') AS kanban_nome,

  COALESCE(kc.kanban_id, vmap.kanban_id) AS kanban_id,

  a.responsavel_id,
  COALESCE(rsp.full_name, rsp.email) AS responsavel_nome,

  a.tipo,

  COALESCE(
    NULLIF(trim(a.titulo), ''),
    NULLIF(trim(a.descricao), ''),
    '(sem tÃ­tulo)'
  ) AS titulo,

  a.descricao,

  a.status AS atividade_status,

  a.data_vencimento,

  a.time AS time_nome,

  a.times_ids,

  ARRAY(
    SELECT t.nome
    FROM   public.kanban_times t
    WHERE  t.id = ANY (a.times_ids)
    ORDER  BY t.nome
  ) AS times_nomes,

  COALESCE(fp_card.full_name, fp_card.email, fp_leg.full_name, fp_leg.email) AS franqueado_nome,

  a.created_at AS criado_em,

  CASE
    WHEN a.data_vencimento IS NULL THEN NULL::text
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::text AS sla_status

FROM public.kanban_atividades a
LEFT JOIN public.kanban_cards kc
  ON kc.id = a.card_id
 AND a.origem = 'nativo'
LEFT JOIN public.v_processo_como_kanban_cards vmap
  ON vmap.id = a.card_id
 AND a.origem = 'legado'
LEFT JOIN public.kanban_fases kf
  ON kf.id = COALESCE(kc.fase_id, vmap.fase_id)
LEFT JOIN public.kanbans k
  ON k.id = COALESCE(kc.kanban_id, vmap.kanban_id)
LEFT JOIN public.profiles rsp
  ON rsp.id = a.responsavel_id
LEFT JOIN public.profiles fp_card
  ON fp_card.id = kc.franqueado_id
LEFT JOIN public.profiles fp_leg
  ON fp_leg.id = vmap.responsavel_id
WHERE
  (a.origem = 'nativo' AND kc.id IS NOT NULL)
  OR (a.origem = 'legado' AND vmap.id IS NOT NULL);

COMMENT ON VIEW public.v_atividades_unificadas IS
  'InteraÃ§Ãµes (kanban_atividades): cards nativos (kanban_cards) ou legados '
  '(processo_step_one via v_processo_como_kanban_cards). Mesmas colunas da 110.';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;
-- â”€â”€â”€ 117: kanban_atividades â€” tabela central de interaÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Expande kanban_atividades com mÃºltiplos responsÃ¡veis, trava e suporte a
-- interaÃ§Ãµes originadas externamente (origem_externa, solicitante_nome/email).
-- responsavel_id (legado, singular) Ã© migrado para responsaveis_ids[].
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” Novas colunas
-- ============================================================
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS responsaveis_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trava BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem_externa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS solicitante_nome TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_email TEXT;

COMMENT ON COLUMN public.kanban_atividades.responsaveis_ids IS
  'Lista de responsÃ¡veis pela atividade. Substitui/complementa responsavel_id singular.';
COMMENT ON COLUMN public.kanban_atividades.trava IS
  'Se true, bloqueia avanÃ§o do card atÃ© esta atividade ser concluÃ­da.';
COMMENT ON COLUMN public.kanban_atividades.origem_externa IS
  'Se true, a atividade foi criada por solicitante externo (nÃ£o usuÃ¡rio interno).';
COMMENT ON COLUMN public.kanban_atividades.solicitante_nome IS
  'Nome do solicitante externo (quando origem_externa = true).';
COMMENT ON COLUMN public.kanban_atividades.solicitante_email IS
  'E-mail do solicitante externo (quando origem_externa = true).';

-- ============================================================
-- PARTE 2 â€” Migrar responsavel_id â†’ responsaveis_ids
-- ============================================================
UPDATE public.kanban_atividades
SET responsaveis_ids = ARRAY[responsavel_id]
WHERE responsavel_id IS NOT NULL
  AND (responsaveis_ids IS NULL OR responsaveis_ids = '{}');

-- ============================================================
-- PARTE 3 â€” Ãndices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kanban_atividades_responsaveis
  ON public.kanban_atividades USING GIN (responsaveis_ids);

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_trava
  ON public.kanban_atividades (trava) WHERE trava = true;
-- â”€â”€â”€ 118: sirene_topicos como sub-interaÃ§Ãµes de kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Vincula tÃ³picos a interaÃ§Ãµes do kanban (interacao_id), adiciona suporte a
-- mÃºltiplos times e responsÃ¡veis, e trava por tÃ³pico (jÃ¡ existia via 039,
-- adicionada aqui para times_ids e responsaveis_ids).
-- Fluxo de aprovaÃ§Ã£o Bombeiro (aprovado_bombeiro / motivo_reprovacao) Ã©
-- DESATIVADO: colunas mantidas no schema, marcadas via COMMENT.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” Novas colunas em sirene_topicos
-- ============================================================
ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS interacao_id UUID REFERENCES public.kanban_atividades(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS times_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS responsaveis_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trava BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.sirene_topicos.interacao_id IS
  'VÃ­nculo com kanban_atividades: tÃ³pico como sub-interaÃ§Ã£o de uma interaÃ§Ã£o do kanban.';
COMMENT ON COLUMN public.sirene_topicos.times_ids IS
  'Times UUID responsÃ¡veis pelo tÃ³pico (complementa time_responsavel texto).';
COMMENT ON COLUMN public.sirene_topicos.responsaveis_ids IS
  'Lista de responsÃ¡veis pelo tÃ³pico. Complementa/substitui responsavel_id singular.';

-- ============================================================
-- PARTE 2 â€” Migrar responsavel_id â†’ responsaveis_ids
-- ============================================================
UPDATE public.sirene_topicos
SET responsaveis_ids = ARRAY[responsavel_id]
WHERE responsavel_id IS NOT NULL
  AND (responsaveis_ids IS NULL OR responsaveis_ids = '{}');

-- ============================================================
-- PARTE 3 â€” Desativar fluxo de aprovaÃ§Ã£o Bombeiro
-- Colunas preservadas para nÃ£o quebrar queries existentes.
-- Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md para reativaÃ§Ã£o.
-- ============================================================
COMMENT ON COLUMN public.sirene_topicos.aprovado_bombeiro IS
  'DESATIVADO â€” fluxo de aprovaÃ§Ã£o removido em migration 118. Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md';
COMMENT ON COLUMN public.sirene_topicos.motivo_reprovacao IS
  'DESATIVADO â€” fluxo de aprovaÃ§Ã£o removido em migration 118. Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md';

-- ============================================================
-- PARTE 4 â€” Ãndices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sirene_topicos_interacao
  ON public.sirene_topicos (interacao_id);

CREATE INDEX IF NOT EXISTS idx_sirene_topicos_responsaveis
  ON public.sirene_topicos USING GIN (responsaveis_ids);
-- â”€â”€â”€ 119: notificaÃ§Ãµes ao atribuir interaÃ§Ãµes (kanban_atividades) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Vincula sirene_notificacoes a kanban_atividades via interacao_id e dispara
-- notificaÃ§Ã£o automÃ¡tica para cada responsÃ¡vel ao INSERT de nova interaÃ§Ã£o.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” interacao_id em sirene_notificacoes
-- ============================================================
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS interacao_id UUID REFERENCES public.kanban_atividades(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.sirene_notificacoes.interacao_id IS
  'ReferÃªncia Ã  interaÃ§Ã£o (kanban_atividades) que gerou a notificaÃ§Ã£o. NULL para notificaÃ§Ãµes de chamado puro.';

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_interacao
  ON public.sirene_notificacoes (interacao_id);

-- ============================================================
-- PARTE 2 â€” Trigger: notificar responsÃ¡veis ao criar interaÃ§Ã£o
-- Silencia erros para nunca bloquear o INSERT da atividade.
-- NÃ£o notifica o prÃ³prio criador da interaÃ§Ã£o.
-- Suporta cards nativos (kanban_cards) e legados (origem = 'legado'):
-- legado nÃ£o tem linha em kanban_cards, card_titulo fica NULL â†’ omitido.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_notificar_responsaveis_interacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resp_id    UUID;
  card_titulo TEXT;
BEGIN
  IF NEW.responsaveis_ids IS NULL OR array_length(NEW.responsaveis_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(titulo, '(sem tÃ­tulo)') INTO card_titulo
  FROM public.kanban_cards
  WHERE id = NEW.card_id
  LIMIT 1;

  FOREACH resp_id IN ARRAY NEW.responsaveis_ids LOOP
    IF resp_id != COALESCE(NEW.criado_por, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.sirene_notificacoes (user_id, interacao_id, tipo, texto)
      VALUES (
        resp_id,
        NEW.id,
        'interacao_atribuida',
        'VocÃª foi atribuÃ­do Ã  interaÃ§Ã£o "' ||
          COALESCE(NEW.titulo, NEW.descricao, 'sem tÃ­tulo') || '"' ||
          CASE WHEN card_titulo IS NOT NULL THEN ' no card ' || card_titulo ELSE '' END
      );
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_interacao ON public.kanban_atividades;
CREATE TRIGGER trg_notificar_interacao
  AFTER INSERT ON public.kanban_atividades
  FOR EACH ROW EXECUTE FUNCTION public.fn_notificar_responsaveis_interacao();

GRANT EXECUTE ON FUNCTION public.fn_notificar_responsaveis_interacao() TO authenticated;
-- â”€â”€â”€ 120: migrar sirene_chamados â†’ kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Chamados existentes nÃ£o tÃªm card de origem; entram como origem='sirene'.
-- Expande o check de origem, torna card_id nullable, migra os chamados e
-- atualiza v_atividades_unificadas para incluir sirene e externo.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 0 â€” View depende de kanban_atividades; derrubar antes
-- ============================================================
DROP VIEW IF EXISTS public.v_atividades_unificadas;

-- ============================================================
-- PARTE 1 â€” Ampliar check de origem
-- ============================================================
ALTER TABLE public.kanban_atividades
  DROP CONSTRAINT IF EXISTS kanban_atividades_origem_check;

ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_origem_check
  CHECK (origem IN ('nativo', 'legado', 'sirene', 'externo'));

-- ============================================================
-- PARTE 2 â€” card_id passa a ser nullable
-- Registros nativo/legado jÃ¡ existentes continuam com valor;
-- sirene/externo entram com card_id = NULL.
-- ============================================================
ALTER TABLE public.kanban_atividades
  ALTER COLUMN card_id DROP NOT NULL;

-- ============================================================
-- PARTE 3 â€” Migrar chamados existentes
-- Idempotente via ON CONFLICT DO NOTHING (nÃ£o hÃ¡ UNIQUE em
-- sirene_chamados.id â†’ kanban_atividades, mas o INSERT duplo
-- seria bloqueado pelo check de origem caso reexecutado num
-- banco zerado). Para evitar duplicatas em reexecuÃ§Ãµes num
-- banco com dados, filtramos chamados que jÃ¡ geraram uma
-- interaÃ§Ã£o origem='sirene' com o mesmo criado_por + created_at.
-- ============================================================
INSERT INTO public.kanban_atividades (
  titulo,
  descricao,
  tipo,
  status,
  trava,
  origem,
  criado_por,
  created_at,
  updated_at
)
SELECT
  sc.incendio                          AS titulo,
  sc.resolucao_pontual                 AS descricao,
  CASE sc.tipo
    WHEN 'hdm' THEN 'chamado_hdm'
    ELSE           'chamado_padrao'
  END                                  AS tipo,
  CASE sc.status
    WHEN 'nao_iniciado'              THEN 'pendente'
    WHEN 'em_andamento'              THEN 'em_andamento'
    WHEN 'concluido'                 THEN 'concluida'
    WHEN 'aguardando_aprovacao_criador' THEN 'em_andamento'
    ELSE                                  'pendente'
  END                                  AS status,
  sc.trava                             AS trava,
  'sirene'                             AS origem,
  sc.aberto_por                        AS criado_por,
  sc.created_at,
  sc.updated_at
FROM public.sirene_chamados sc
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_atividades ka
  WHERE ka.origem    = 'sirene'
    AND ka.criado_por = sc.aberto_por
    AND ka.created_at = sc.created_at
);

-- ============================================================
-- PARTE 4 â€” Recriar v_atividades_unificadas
-- Colunas idÃªnticas Ã  migration 116 + suporte a sirene/externo:
--   card_titulo  â†’ '(chamado direto)' | '(externo)'
--   kanban_nome  â†’ 'Sirene'           | 'Externo'
--   fase_nome    â†’ '' (sem fase)
--   kanban_id    â†’ NULL
--   franqueado_nome â†’ NULL
-- ============================================================
CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.card_id,

  COALESCE(
    kc.titulo,
    vmap.titulo,
    CASE a.origem
      WHEN 'sirene'   THEN '(chamado direto)'
      WHEN 'externo'  THEN '(externo)'
      ELSE                 '(sem tÃ­tulo)'
    END
  ) AS card_titulo,

  COALESCE(kf.nome, '') AS fase_nome,

  COALESCE(
    k.nome,
    CASE a.origem
      WHEN 'sirene'  THEN 'Sirene'
      WHEN 'externo' THEN 'Externo'
      ELSE                ''
    END
  ) AS kanban_nome,

  COALESCE(kc.kanban_id, vmap.kanban_id) AS kanban_id,

  a.responsavel_id,
  COALESCE(rsp.full_name, rsp.email) AS responsavel_nome,

  a.tipo,

  COALESCE(
    NULLIF(trim(a.titulo), ''),
    NULLIF(trim(a.descricao), ''),
    '(sem tÃ­tulo)'
  ) AS titulo,

  a.descricao,

  a.status AS atividade_status,

  a.data_vencimento,

  a.time AS time_nome,

  a.times_ids,

  ARRAY(
    SELECT t.nome
    FROM   public.kanban_times t
    WHERE  t.id = ANY (a.times_ids)
    ORDER  BY t.nome
  ) AS times_nomes,

  COALESCE(fp_card.full_name, fp_card.email, fp_leg.full_name, fp_leg.email) AS franqueado_nome,

  a.created_at AS criado_em,

  CASE
    WHEN a.data_vencimento IS NULL    THEN NULL::text
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::text AS sla_status

FROM public.kanban_atividades a
LEFT JOIN public.kanban_cards kc
  ON kc.id = a.card_id
 AND a.origem = 'nativo'
LEFT JOIN public.v_processo_como_kanban_cards vmap
  ON vmap.id = a.card_id
 AND a.origem = 'legado'
LEFT JOIN public.kanban_fases kf
  ON kf.id = COALESCE(kc.fase_id, vmap.fase_id)
LEFT JOIN public.kanbans k
  ON k.id = COALESCE(kc.kanban_id, vmap.kanban_id)
LEFT JOIN public.profiles rsp
  ON rsp.id = a.responsavel_id
LEFT JOIN public.profiles fp_card
  ON fp_card.id = kc.franqueado_id
LEFT JOIN public.profiles fp_leg
  ON fp_leg.id = vmap.responsavel_id
WHERE
  (a.origem = 'nativo'  AND kc.id   IS NOT NULL)
  OR (a.origem = 'legado'   AND vmap.id IS NOT NULL)
  OR  a.origem = 'sirene'
  OR  a.origem = 'externo';

COMMENT ON VIEW public.v_atividades_unificadas IS
  'InteraÃ§Ãµes (kanban_atividades): cards nativos, legados (processo_step_one), '
  'chamados Sirene (origem=sirene) e interaÃ§Ãµes externas (origem=externo). '
  'Mesmas colunas da migration 116.';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;
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
