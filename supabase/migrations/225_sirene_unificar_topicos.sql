-- 225: Unificar tópicos Sirene via interacao_id + time_abertura_nome
-- Backfill pesado opcional: supabase/scripts/225_226_backfill.sql

-- ─── time_abertura_nome (exibição no painel Sirene) ───────────────────────────
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS time_abertura_nome TEXT;

COMMENT ON COLUMN public.kanban_atividades.time_abertura_nome IS
  'Time de abertura exibido no painel Sirene (geralmente 1º time da 1ª atividade).';

-- Backfill rápido via sirene_chamados (fallback por tópicos: script opcional)
UPDATE public.kanban_atividades ka
SET time_abertura_nome = NULLIF(TRIM(sc.time_abertura), '')
FROM public.sirene_chamados sc
WHERE ka.origem = 'sirene'
  AND ka.sirene_chamado_id = sc.id
  AND (ka.time_abertura_nome IS NULL OR TRIM(ka.time_abertura_nome) = '')
  AND NULLIF(TRIM(sc.time_abertura), '') IS NOT NULL;

-- ─── Backfill interacao_id em tópicos legados (chamado_id only) ───────────────
-- Um kanban_atividade por sirene_chamado_id (índice único em 164).
UPDATE public.sirene_topicos st
SET interacao_id = pick.ka_id
FROM (
  SELECT DISTINCT ON (ka.sirene_chamado_id)
    ka.sirene_chamado_id,
    ka.id AS ka_id
  FROM public.kanban_atividades ka
  WHERE ka.origem = 'sirene'
    AND ka.sirene_chamado_id IS NOT NULL
  ORDER BY ka.sirene_chamado_id, ka.created_at NULLS LAST, ka.id
) pick
WHERE st.chamado_id IS NOT NULL
  AND st.interacao_id IS NULL
  AND st.chamado_id = pick.sirene_chamado_id;

-- ─── View: categoria + time_abertura_nome (chamado_numero vem na 226) ───────
DROP VIEW IF EXISTS public.v_atividades_unificadas;

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
  a.categoria,
  a.time_abertura_nome,

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
  'Interações unificadas: cards nativos/legados, Sirene e externo. Inclui categoria e time_abertura_nome.';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
