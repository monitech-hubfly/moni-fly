-- =============================================================================
-- prod_bootstrap.sql — alinhamento PROD com o efeito das migrations 115–147
-- =============================================================================
-- Objetivo: correr UMA vez numa base PROD que já tem dados reais e, em muitos
-- casos, tabelas kanban vazias e colunas adicionadas manualmente. Depois, o
-- `npx supabase db push` destas migrations deve aplicar sem erro (muitas
-- operações são idempotentes: IF NOT EXISTS, OR REPLACE, DROP POLICY + CREATE).
--
-- Regras de segurança de dados (pedido):
--   - Não usa DROP TABLE, TRUNCATE, DELETE sem WHERE.
--   - Não recria tabelas de negócio preenchidas.
--   Ajustes não destrutivos:
--   - v_atividades_unificadas: sem DROP VIEW; usamos CREATE OR REPLACE na 120.
--   - 122 (seed de exemplos): OMITIDO no bootstrap para não inserir dados de
--     teste em PROD; trate com `migration repair` se o push esbarrar na 122.
--   - 136: remove coluna `rede_franqueados.data_kit_boas_vindas` (único DROP
--     COLUMN; alinhado à migration — perde-se só essa coluna, não linhas).
--
-- Ordem: concatenação das migrations 115…147. Comentário de seção por ficheiro.
-- =============================================================================


-- === MIGRATION 115: 115_sla_fases_legadas.sql ===
UPDATE public.kanban_fases
SET sla_dias = 7
WHERE kanban_id IN (
  SELECT id FROM public.kanbans
  WHERE nome IN ('Funil Portfólio', 'Funil Operações', 'Funil Contabilidade', 'Funil Crédito')
)
AND sla_dias IS NULL;


-- === MIGRATION 116: 116_fk_suporte_legado.sql ===
-- ─── 116: FK suporte a cards legados (processo_step_one) ─────────────────────
-- Problema: kanban_historico, kanban_atividades e kanban_card_comentarios
-- referenciavam kanban_cards(id), mas cards legados usam UUID de processo_step_one.
-- Solução: remover FKs de card_id; em atividades, coluna origem nativo|legado.
-- Atualiza RLS e recria v_atividades_unificadas (compatível com migration 110 + app).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 0 — (bootstrap PROD) sem DROP VIEW: não destrutivo. A view final é
-- definida após a migration 120 com CREATE OR REPLACE VIEW.
-- ============================================================

-- ============================================================
-- PARTE 1 — kanban_atividades
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

-- RLS: mesma regra de cards + processo dono (frank) ou já coberto por admin/consultor
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
-- PARTE 2 — kanban_historico
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
-- PARTE 3 — kanban_card_comentarios
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

-- PARTE 4: view pública (versão 116) omitida; ver migration 120 — CREATE OR REPLACE public.v_atividades_unificadas.


-- === MIGRATION 117: 117_interacoes_completas.sql ===
-- ─── 117: kanban_atividades — tabela central de interações ──────────────────
-- Expande kanban_atividades com múltiplos responsáveis, trava e suporte a
-- interações originadas externamente (origem_externa, solicitante_nome/email).
-- responsavel_id (legado, singular) é migrado para responsaveis_ids[].
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 — Novas colunas
-- ============================================================
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS responsaveis_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trava BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem_externa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS solicitante_nome TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_email TEXT;

COMMENT ON COLUMN public.kanban_atividades.responsaveis_ids IS
  'Lista de responsáveis pela atividade. Substitui/complementa responsavel_id singular.';
COMMENT ON COLUMN public.kanban_atividades.trava IS
  'Se true, bloqueia avanço do card até esta atividade ser concluída.';
COMMENT ON COLUMN public.kanban_atividades.origem_externa IS
  'Se true, a atividade foi criada por solicitante externo (não usuário interno).';
COMMENT ON COLUMN public.kanban_atividades.solicitante_nome IS
  'Nome do solicitante externo (quando origem_externa = true).';
COMMENT ON COLUMN public.kanban_atividades.solicitante_email IS
  'E-mail do solicitante externo (quando origem_externa = true).';

-- ============================================================
-- PARTE 2 — Migrar responsavel_id → responsaveis_ids
-- ============================================================
UPDATE public.kanban_atividades
SET responsaveis_ids = ARRAY[responsavel_id]
WHERE responsavel_id IS NOT NULL
  AND (responsaveis_ids IS NULL OR responsaveis_ids = '{}');

-- ============================================================
-- PARTE 3 — Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kanban_atividades_responsaveis
  ON public.kanban_atividades USING GIN (responsaveis_ids);

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_trava
  ON public.kanban_atividades (trava) WHERE trava = true;


-- === MIGRATION 118: 118_subinteracoes.sql ===
-- ─── 118: sirene_topicos como sub-interações de kanban_atividades ─────────────
-- Vincula tópicos a interações do kanban (interacao_id), adiciona suporte a
-- múltiplos times e responsáveis, e trava por tópico (já existia via 039,
-- adicionada aqui para times_ids e responsaveis_ids).
-- Fluxo de aprovação Bombeiro (aprovado_bombeiro / motivo_reprovacao) é
-- DESATIVADO: colunas mantidas no schema, marcadas via COMMENT.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 — Novas colunas em sirene_topicos
-- ============================================================
ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS interacao_id UUID REFERENCES public.kanban_atividades(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS times_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS responsaveis_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trava BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.sirene_topicos.interacao_id IS
  'Vínculo com kanban_atividades: tópico como sub-interação de uma interação do kanban.';
COMMENT ON COLUMN public.sirene_topicos.times_ids IS
  'Times UUID responsáveis pelo tópico (complementa time_responsavel texto).';
COMMENT ON COLUMN public.sirene_topicos.responsaveis_ids IS
  'Lista de responsáveis pelo tópico. Complementa/substitui responsavel_id singular.';

-- ============================================================
-- PARTE 2 — Migrar responsavel_id → responsaveis_ids
-- ============================================================
UPDATE public.sirene_topicos
SET responsaveis_ids = ARRAY[responsavel_id]
WHERE responsavel_id IS NOT NULL
  AND (responsaveis_ids IS NULL OR responsaveis_ids = '{}');

-- ============================================================
-- PARTE 3 — Desativar fluxo de aprovação Bombeiro
-- Colunas preservadas para não quebrar queries existentes.
-- Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md para reativação.
-- ============================================================
COMMENT ON COLUMN public.sirene_topicos.aprovado_bombeiro IS
  'DESATIVADO — fluxo de aprovação removido em migration 118. Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md';
COMMENT ON COLUMN public.sirene_topicos.motivo_reprovacao IS
  'DESATIVADO — fluxo de aprovação removido em migration 118. Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md';

-- ============================================================
-- PARTE 4 — Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sirene_topicos_interacao
  ON public.sirene_topicos (interacao_id);

CREATE INDEX IF NOT EXISTS idx_sirene_topicos_responsaveis
  ON public.sirene_topicos USING GIN (responsaveis_ids);


-- === MIGRATION 119: 119_notificacoes_interacoes.sql ===
-- ─── 119: notificações ao atribuir interações (kanban_atividades) ─────────────
-- Vincula sirene_notificacoes a kanban_atividades via interacao_id e dispara
-- notificação automática para cada responsável ao INSERT de nova interação.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 — interacao_id em sirene_notificacoes
-- ============================================================
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS interacao_id UUID REFERENCES public.kanban_atividades(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.sirene_notificacoes.interacao_id IS
  'Referência à interação (kanban_atividades) que gerou a notificação. NULL para notificações de chamado puro.';

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_interacao
  ON public.sirene_notificacoes (interacao_id);

-- ============================================================
-- PARTE 2 — Trigger: notificar responsáveis ao criar interação
-- Silencia erros para nunca bloquear o INSERT da atividade.
-- Não notifica o próprio criador da interação.
-- Suporta cards nativos (kanban_cards) e legados (origem = 'legado'):
-- legado não tem linha em kanban_cards, card_titulo fica NULL → omitido.
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

  SELECT COALESCE(titulo, '(sem título)') INTO card_titulo
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
        'Você foi atribuído à interação "' ||
          COALESCE(NEW.titulo, NEW.descricao, 'sem título') || '"' ||
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


-- === MIGRATION 120: 120_migrar_chamados_para_interacoes.sql ===
-- ─── 120: migrar sirene_chamados → kanban_atividades ─────────────────────────
-- Chamados existentes não têm card de origem; entram como origem='sirene'.
-- Expande o check de origem, torna card_id nullable, migra os chamados e
-- atualiza v_atividades_unificadas para incluir sirene e externo.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- PARTE 0: sem DROP VIEW (bootstrap PROD; usa CREATE OR REPLACE abaixo).

-- ============================================================
-- PARTE 1 — Ampliar check de origem
-- ============================================================
ALTER TABLE public.kanban_atividades
  DROP CONSTRAINT IF EXISTS kanban_atividades_origem_check;

ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_origem_check
  CHECK (origem IN ('nativo', 'legado', 'sirene', 'externo'));

-- ============================================================
-- PARTE 2 — card_id passa a ser nullable
-- Registros nativo/legado já existentes continuam com valor;
-- sirene/externo entram com card_id = NULL.
-- ============================================================
ALTER TABLE public.kanban_atividades
  ALTER COLUMN card_id DROP NOT NULL;

-- ============================================================
-- PARTE 3 — Migrar chamados existentes
-- Idempotente via ON CONFLICT DO NOTHING (não há UNIQUE em
-- sirene_chamados.id → kanban_atividades, mas o INSERT duplo
-- seria bloqueado pelo check de origem caso reexecutado num
-- banco zerado). Para evitar duplicatas em reexecuções num
-- banco com dados, filtramos chamados que já geraram uma
-- interação origem='sirene' com o mesmo criado_por + created_at.
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
-- PARTE 4 — Recriar v_atividades_unificadas
-- Colunas idênticas à migration 116 + suporte a sirene/externo:
--   card_titulo  → '(chamado direto)' | '(externo)'
--   kanban_nome  → 'Sirene'           | 'Externo'
--   fase_nome    → '' (sem fase)
--   kanban_id    → NULL
--   franqueado_nome → NULL
-- ============================================================
CREATE OR REPLACE VIEW public.v_atividades_unificadas
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
      ELSE                 '(sem título)'
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
    '(sem título)'
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
  'Interações (kanban_atividades): cards nativos, legados (processo_step_one), '
  'chamados Sirene (origem=sirene) e interações externas (origem=externo). '
  'Mesmas colunas da migration 116.';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;


-- === MIGRATION 121: 121_sirene_topicos_kanban_sub.sql ===
-- ─── 121: sirene_topicos como sub-interação só de kanban (sem chamado) ───────
-- Permite chamado_id NULL quando interacao_id aponta para kanban_atividades.
-- Ajusta RLS para linhas vinculadas a interação (acesso alinhado ao card/atividade).

ALTER TABLE public.sirene_topicos
  ALTER COLUMN chamado_id DROP NOT NULL;

COMMENT ON COLUMN public.sirene_topicos.chamado_id IS
  'Chamado Sirene (legado). NULL quando o tópico é sub-interação de kanban_atividades (interacao_id).';

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


-- === MIGRATION 122: 122_seed_interacoes_exemplo.sql ===
-- (bootstrap PROD) OMITIDO: a migration 122 insere dados de exemplo (teste de painel).
-- Em produção, não executar os INSERTS; use "supabase migration repair" se necessário
-- após o push, ou deixe o `db push` aplicar 122 (idempotente, mas ainda cria rows de teste
-- se não existirem). Aqui: nenhum INSERT para evitar poluir PROD.

-- === MIGRATION 123: 123_arquivamento_e_sla.sql ===
-- ─── 123: arquivamento de cards + SLA configurável em fases ─────────────────
-- Parte 1: colunas de arquivamento em kanban_cards + trigger de log.
-- Parte 2: SLA padrão 7 dias em kanban_fases + fn_atualizar_sla_fase().
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 — Arquivamento em kanban_cards
-- ============================================================

-- 1a. Novas colunas
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

-- 1b. Índice parcial — só indexa cards arquivados (minoria)
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

-- 1d. Trigger: loga arquivamento quando arquivado muda de false → true
CREATE OR REPLACE FUNCTION public.fn_log_arquivamento_card()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Só dispara quando arquivado efetivamente virou true
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

-- ============================================================
-- PARTE 2 — SLA configurável em kanban_fases
-- ============================================================

-- 2a. Preencher sla_dias nulos restantes e fixar default
UPDATE public.kanban_fases
SET sla_dias = 7
WHERE sla_dias IS NULL;

ALTER TABLE public.kanban_fases
  ALTER COLUMN sla_dias SET DEFAULT 7;

COMMENT ON COLUMN public.kanban_fases.sla_dias IS
  'SLA em dias úteis para cards nesta fase. Default 7. Configurável via fn_atualizar_sla_fase().';

-- 2b. Função para atualizar SLA de uma fase com validação
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


-- === MIGRATION 124: 124_finalizacao_e_retrabalho.sql ===
-- ─── 124: finalização de cards + métricas de retrabalho + SLA acumulado ──────
-- Parte 1: colunas concluido/concluido_em/concluido_por em kanban_cards.
-- Parte 2: coluna is_retrocesso em kanban_historico + trigger fn_marcar_retrocesso.
-- Parte 3: substituição de fn_historico_fase_alterada (108) para incluir ordens no detalhe.
-- Parte 4: sla_dias_acumulados em kanban_cards.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 — Colunas de finalização em kanban_cards
-- ============================================================

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS concluido       BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS concluido_em    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concluido_por   UUID        REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.kanban_cards.concluido IS
  'Se true, card foi finalizado manualmente.';
COMMENT ON COLUMN public.kanban_cards.concluido_em IS
  'Timestamp da finalização do card.';
COMMENT ON COLUMN public.kanban_cards.concluido_por IS
  'Usuário que finalizou o card.';

-- ============================================================
-- PARTE 2 — Métricas de retrabalho em kanban_historico
-- ============================================================

ALTER TABLE public.kanban_historico
  ADD COLUMN IF NOT EXISTS is_retrocesso BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.kanban_historico.is_retrocesso IS
  'true quando a mudança de fase representa retrocesso (fase_nova_ordem < fase_anterior_ordem).';

-- Trigger que marca is_retrocesso logo após inserção no histórico.
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
-- PARTE 3 — Atualiza fn_historico_fase_alterada (migration 108)
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
    RAISE WARNING 'fn_historico_fase_alterada: erro ignorado — %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_historico_fase_alterada() IS
  'Registra fase_avancada ou fase_retrocedida ao mover card entre fases. '
  'detalhe inclui ids, nomes e ordens das fases anterior e nova (necessário para is_retrocesso).';

-- Backfill: marcar is_retrocesso em linhas históricas que já tenham ordens no detalhe
UPDATE public.kanban_historico
SET is_retrocesso = (
  (detalhe->>'fase_nova_ordem')::int < (detalhe->>'fase_anterior_ordem')::int
)
WHERE acao IN ('fase_avancada', 'fase_retrocedida')
  AND (detalhe->>'fase_nova_ordem') IS NOT NULL
  AND (detalhe->>'fase_anterior_ordem') IS NOT NULL;

-- ============================================================
-- PARTE 4 — SLA acumulado por card
-- ============================================================

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS sla_dias_acumulados INTEGER DEFAULT 0;

COMMENT ON COLUMN public.kanban_cards.sla_dias_acumulados IS
  'Dias úteis de SLA já consumidos antes do retrocesso de fase. '
  'Nunca é zerado em retrocessos — preserva o tempo já gasto no processo.';


-- === MIGRATION 125: 125_kanban_card_cronologia.sql ===
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


-- === MIGRATION 126: 126_kanban_cards_concluido.sql ===
-- Finalização explícita de card (ação finalizarCard) + colunas concluido / concluido_por.
-- Remove o trigger antigo que gravava concluido_em ao entrar na última fase (125): concluido_em passa a ser só da finalização.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS concluido BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS concluido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.kanban_cards.concluido IS 'Card finalizado pelo usuário (server action finalizarCard).';
COMMENT ON COLUMN public.kanban_cards.concluido_por IS 'Usuário que finalizou o card.';

COMMENT ON COLUMN public.kanban_cards.concluido_em IS
  'Timestamp definido em finalizarCard quando concluido = true.';

DROP TRIGGER IF EXISTS trg_kanban_cards_concluido_fase ON public.kanban_cards;
DROP FUNCTION IF EXISTS public.fn_kanban_cards_concluido_ultima_fase();

-- Limpa timestamps antigos gerados pelo trigger removido (card ainda não finalizado)
UPDATE public.kanban_cards
SET concluido_em = NULL
WHERE concluido IS NOT TRUE;


-- === MIGRATION 127: 127_kanban_modal_rede_contrato_rls.sql ===
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

-- Consultores podem atualizar processos da carteira (pré-obra no modal Kanban).
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


-- === MIGRATION 128: 128_funil_acoplamento.sql ===
-- Migration 128: Kanban "Funil Acoplamento" + 4 fases (idempotente).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 1 — Registrar o kanban
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.kanbans (nome, descricao)
SELECT 'Funil Acoplamento', 'Gestão do processo de acoplamento de terreno e casa'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans WHERE nome = 'Funil Acoplamento'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 2 — Inserir as 4 fases
-- ═══════════════════════════════════════════════════════════════════════════
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
  ('Validação do Acoplamento', 'validacao_acoplamento', 3),
  ('Alterações do Acoplamento', 'alteracoes_acoplamento', 4)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'Funil Acoplamento'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 3 — Garantir GRANTs
-- ═══════════════════════════════════════════════════════════════════════════
GRANT SELECT ON public.kanbans TO authenticated, anon;
GRANT SELECT ON public.kanban_fases TO authenticated, anon;


-- === MIGRATION 129: 129_fases_instrucoes.sql ===
-- ─── 129: Instruções e materiais em kanban_fases (modal kanban) ───────────────

ALTER TABLE public.kanban_fases
  ADD COLUMN IF NOT EXISTS instrucoes TEXT,
  ADD COLUMN IF NOT EXISTS materiais JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.kanban_fases.instrucoes IS
  'Orientações da fase exibidas no KanbanCardModal.';
COMMENT ON COLUMN public.kanban_fases.materiais IS
  'JSON array: [{"titulo","url","tipo"}]; tipo: link | documento | video.';

-- Após 099 (só SELECT em kanban_fases): permitir UPDATE para admin/consultor.
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


-- === MIGRATION 130: 130_vinculos_cards.sql ===
-- ─── 130: Vínculos entre cards nativos (relacionamentos no modal) ────────────

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
  'Relacionamentos entre cards: origem → destino conforme tipo_vinculo.';

ALTER TABLE public.kanban_card_vinculos ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado (card visível no modal já passou RLS do card).
DROP POLICY IF EXISTS "kanban_card_vinculos_select_auth" ON public.kanban_card_vinculos;
CREATE POLICY "kanban_card_vinculos_select_auth"
  ON public.kanban_card_vinculos
  FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: admin e consultor (alinhado a outras tabelas de configuração do kanban).
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


-- === MIGRATION 131: 131_convites_frank.sql ===
-- ─── 131: Convites Portal Frank (link 7 dias) ───────────────────────────────

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


-- === MIGRATION 132: 132_roles_e_cargos.sql ===
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


-- === MIGRATION 133: 133_permissoes_por_cargo.sql ===
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
  'Matriz de permissões por role + cargo. Lida pelo frontend para controlar acesso a ações.';

ALTER TABLE public.permissoes_perfil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissoes_perfil_select_auth" ON public.permissoes_perfil;
CREATE POLICY "permissoes_perfil_select_auth"
  ON public.permissoes_perfil FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.permissoes_perfil (role, cargo, permissao, valor) VALUES
-- ── Admin / adm ──────────────────────────────────────────────────────────────
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
-- ── Admin / analista ─────────────────────────────────────────────────────────
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
-- ── Admin / estagiario ───────────────────────────────────────────────────────
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
-- ── Team / adm ───────────────────────────────────────────────────────────────
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
-- ── Team / analista ──────────────────────────────────────────────────────────
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
-- ── Team / estagiario ────────────────────────────────────────────────────────
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
-- ── Frank / adm ──────────────────────────────────────────────────────────────
('frank', 'adm', 'criar_chamados',  true),
('frank', 'adm', 'ver_dashboard',   true),
('frank', 'adm', 'criar_cards',     false),
('frank', 'adm', 'mover_fase',      false),
('frank', 'adm', 'arquivar_cards',  false),
('frank', 'adm', 'finalizar_cards', false),
('frank', 'adm', 'ver_sirene',      false),
-- ── Frank / analista ─────────────────────────────────────────────────────────
('frank', 'analista', 'criar_chamados',  true),
('frank', 'analista', 'ver_dashboard',   false),
('frank', 'analista', 'criar_cards',     false),
('frank', 'analista', 'mover_fase',      false),
('frank', 'analista', 'arquivar_cards',  false),
('frank', 'analista', 'finalizar_cards', false),
('frank', 'analista', 'ver_sirene',      false),
-- ── Frank / estagiario ───────────────────────────────────────────────────────
('frank', 'estagiario', 'criar_chamados', false),
('frank', 'estagiario', 'ver_dashboard',  false),
-- ── Parceiro ─────────────────────────────────────────────────────────────────
('parceiro', 'adm',       'criar_chamados', true),
('parceiro', 'analista',  'criar_chamados', true),
('parceiro', 'estagiario','criar_chamados', false),
-- ── Fornecedor ───────────────────────────────────────────────────────────────
('fornecedor', 'adm',       'criar_chamados', true),
('fornecedor', 'analista',  'criar_chamados', true),
('fornecedor', 'estagiario','criar_chamados', false)
ON CONFLICT (role, cargo, permissao) DO NOTHING;

GRANT SELECT ON public.permissoes_perfil TO authenticated, anon;


-- === MIGRATION 134: 134_profiles_funis_acesso.sql ===
-- Kanbans permitidos (Time + Estagiário): valores = public.kanbans.nome
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS funis_acesso TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.profiles.funis_acesso IS
  'Lista de kanbans.nome acessíveis; usado para Time + estagiário. NULL = não aplicável ou sem restrição por esta lista.';


-- === MIGRATION 135: 135_frank_validacao_trimestral.sql ===
-- Validação trimestral de dados (Frank) + vínculo perfil ↔ rede_franqueados + RLS

-- ─── 1. Tabela de validações ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.frank_validacoes_dados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frank_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  validado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (frank_id, periodo)
);

COMMENT ON TABLE public.frank_validacoes_dados IS
  'Confirmação trimestral de dados do franqueado (periodo ex.: 2026-01, 2026-04, 2026-07, 2026-11).';

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

-- ─── 2. Perfil → linha da rede (cadastro portal) ─────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rede_franqueado_id UUID REFERENCES public.rede_franqueados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.rede_franqueado_id IS
  'Linha em rede_franqueados associada ao franqueado (portal).';

CREATE INDEX IF NOT EXISTS idx_profiles_rede_franqueado_id ON public.profiles (rede_franqueado_id);

-- ─── 3. Frank pode atualizar a própria linha na rede ────────────────────────
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

-- ─── 4. Convites Frank: admin ou time (legado consultor → team na 132) ───────
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


-- === MIGRATION 136: 136_rede_remover_kit_boas_vindas.sql ===
ALTER TABLE public.rede_franqueados
  DROP COLUMN IF EXISTS data_kit_boas_vindas;


-- === MIGRATION 137: 137_anexos_chamados_e_rede.sql ===
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


-- === MIGRATION 138: 138_chamado_anexos_rls_criador.sql ===
-- Frank / criador do chamado: ver anexos e inserir só nos chamados que criou (ou admin/team/responsável).

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


-- === MIGRATION 139: 139_rede_attachments_select_staff.sql ===
-- Documentos sensíveis da rede: só admin/team leem no storage (Frank autenticado não baixa).

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


-- === MIGRATION 140: 140_rede_franqueados_update_team.sql ===
-- Time interno pode atualizar linhas da rede (ex.: anexos COF / contrato assinado).

DROP POLICY IF EXISTS "rede_franqueados_update_team" ON public.rede_franqueados;
CREATE POLICY "rede_franqueados_update_team"
  ON public.rede_franqueados FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'team'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'team'));


-- === MIGRATION 141: 141_rede_attachments_insert_consultor.sql ===
-- Consultores também enviam documentos da rede (alinha ao UPDATE em rede_franqueados).

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


-- === MIGRATION 142: 142_chamado_mencoes.sql ===
-- Tabela de menções vinculadas a comentários do Sirene
CREATE TABLE IF NOT EXISTS public.chamado_mencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comentario_id BIGINT NOT NULL REFERENCES public.sirene_mensagens(id) ON DELETE CASCADE,
  mencionado_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chamado_id BIGINT NOT NULL REFERENCES public.sirene_chamados(id) ON DELETE CASCADE,
  lido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chamado_mencoes ENABLE ROW LEVEL SECURITY;

-- Usuário vê só as próprias menções
DROP POLICY IF EXISTS "mencoes_select_proprio" ON public.chamado_mencoes;
CREATE POLICY "mencoes_select_proprio" ON public.chamado_mencoes
  FOR SELECT USING (mencionado_id = auth.uid());

-- Apenas autenticados inserem (Frank bloqueado via app, não via RLS)
DROP POLICY IF EXISTS "mencoes_insert_autenticado" ON public.chamado_mencoes;
CREATE POLICY "mencoes_insert_autenticado" ON public.chamado_mencoes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Marcar como lido
DROP POLICY IF EXISTS "mencoes_update_proprio" ON public.chamado_mencoes;
CREATE POLICY "mencoes_update_proprio" ON public.chamado_mencoes
  FOR UPDATE USING (mencionado_id = auth.uid());

-- Índices
CREATE INDEX IF NOT EXISTS idx_mencoes_mencionado ON public.chamado_mencoes(mencionado_id);
CREATE INDEX IF NOT EXISTS idx_mencoes_comentario ON public.chamado_mencoes(comentario_id);


-- === MIGRATION 143: 143_sirene_notificacoes_titulo_mensagem_referencia.sql ===
-- Estrutura padronizada para avisos (ex.: menção em comentário de chamado)
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS mensagem TEXT,
  ADD COLUMN IF NOT EXISTS referencia_id BIGINT REFERENCES public.sirene_chamados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sirene_notificacoes.titulo IS 'Título curto do aviso (UI).';
COMMENT ON COLUMN public.sirene_notificacoes.mensagem IS 'Corpo do aviso; preferir este campo em novos tipos.';
COMMENT ON COLUMN public.sirene_notificacoes.referencia_id IS 'Referência principal (ex.: id do chamado Sirene).';

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_referencia
  ON public.sirene_notificacoes (referencia_id);


-- === MIGRATION 144: 144_checklist_card.sql ===
-- Checklist por card do kanban com visibilidade por responsável (Frank vê só os próprios)

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
  'Itens de checklist por card do kanban; frank vê somente os itens em que é responsável (RLS).';

ALTER TABLE public.kanban_checklist_itens ENABLE ROW LEVEL SECURITY;

-- Internos (não frank/franqueado) veem todos os itens do card
DROP POLICY IF EXISTS "checklist_select_interno" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_select_interno" ON public.kanban_checklist_itens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
  );

-- Frank/franqueado vê somente os itens onde é o responsável
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

-- Marcar feito: o próprio responsável OU um interno
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


-- === MIGRATION 145: 145_aprovacoes_fase.sql ===
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


-- === MIGRATION 146: 146_chamado_visivel_frank.sql ===
-- Chamados internos vs visíveis para Frank/franqueado (RLS SELECT).
-- Internos: visivel_frank = FALSE (default). Abertos pelo próprio Frank/franqueado: TRUE.

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

-- Substitui a policy de 037: internos veem tudo; Frank/franqueado só linhas visivel_frank.
-- Mantém sirene_chamados_hdm_team_select (035) como OR adicional para times HDM.
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


-- === MIGRATION 147: 147_bombeiro_aprovacoes_fase_referencia_card_rls.sql ===
-- 1) Referência a card de kanban em notificações.
--    `referencia_id` (BIGINT) continua a apontar para `sirene_chamados`; para cards usa-se UUID aqui.
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS referencia_card_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_referencia_card
  ON public.sirene_notificacoes (referencia_card_id);

COMMENT ON COLUMN public.sirene_notificacoes.referencia_card_id IS
  'Card de kanban (ex.: rejeição de aprovação de fase). O pedido "referencia_id" para UUID usa esta coluna.';

-- 2) Bombeiro: ler cards com aprovação de fase pendente
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

-- 3) Bombeiro: ver nome do Frank que solicitou a aprovação
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

-- 4) Bombeiro: itens de checklist (contagem) para cards com aprovação pendente
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

