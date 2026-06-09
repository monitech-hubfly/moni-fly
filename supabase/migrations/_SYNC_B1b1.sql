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
