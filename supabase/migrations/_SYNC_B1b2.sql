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
