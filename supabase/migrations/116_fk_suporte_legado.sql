-- ─── 116: FK suporte a cards legados (processo_step_one) ─────────────────────
-- Problema: kanban_historico, kanban_atividades e kanban_card_comentarios
-- referenciavam kanban_cards(id), mas cards legados usam UUID de processo_step_one.
-- Solução: remover FKs de card_id; em atividades, coluna origem nativo|legado.
-- Atualiza RLS e recria v_atividades_unificadas (compatível com migration 110 + app).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 0 — View depende de kanban_atividades; derrubar antes
-- ============================================================
DROP VIEW IF EXISTS public.v_atividades_unificadas;

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

-- ============================================================
-- PARTE 4 — v_atividades_unificadas (nativo + legado)
-- Colunas alinhadas à migration 110 (app / card-actions).
-- sla_status: NULL sem prazo (filtro "sem_prazo" no painel).
-- ============================================================
CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.card_id,

  COALESCE(kc.titulo, vmap.titulo, '(sem título)') AS card_titulo,

  COALESCE(kf.nome, '') AS fase_nome,

  COALESCE(k.nome, '') AS kanban_nome,

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
  'Interações (kanban_atividades): cards nativos (kanban_cards) ou legados '
  '(processo_step_one via v_processo_como_kanban_cards). Mesmas colunas da 110.';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;
