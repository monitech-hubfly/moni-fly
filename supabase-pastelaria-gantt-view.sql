-- =============================================================================
-- Pastelaria — view Gantt (com responsável nos cards)
-- Execute no Supabase SQL Editor. Depois: NOTIFY pgrst, 'reload schema';
-- =============================================================================

CREATE OR REPLACE VIEW public.pastelaria_gantt_semanas AS
WITH cards_ativos AS (
  SELECT
    c.id,
    c.nome,
    c.coluna,
    c.completed_week,
    c.semana_origem,
    c.responsavel_id,
    c.responsavel_nome,
    a.nome AS area_nome,
    ap.nome AS responsavel_pessoa_nome
  FROM pastelaria_cards c
  LEFT JOIN areas a ON a.id = c.area_id
  LEFT JOIN area_pessoas ap ON ap.id = c.responsavel_id
  WHERE c.coluna IN ('done', 'doing')
    AND COALESCE(c.reclassificado, false) = false
),
base AS (
  SELECT
    COALESCE(h.semana, ca.semana_origem) AS semana,
    ca.id,
    ca.nome,
    ca.area_nome,
    ca.coluna,
    ca.completed_week,
    COALESCE(ca.responsavel_pessoa_nome, ca.responsavel_nome) AS responsavel_nome,
    jsonb_build_object(
      'seg', COALESCE(h.seg, 0),
      'ter', COALESCE(h.ter, 0),
      'qua', COALESCE(h.qua, 0),
      'qui', COALESCE(h.qui, 0),
      'sex', COALESCE(h.sex, 0)
    ) AS horas_por_semana,
    (
      COALESCE(h.seg, 0) + COALESCE(h.ter, 0) + COALESCE(h.qua, 0)
      + COALESCE(h.qui, 0) + COALESCE(h.sex, 0)
    ) AS total_horas_semana
  FROM cards_ativos ca
  LEFT JOIN pastelaria_horas h ON h.card_id = ca.id
)
SELECT
  semana,
  COUNT(*)::bigint AS total_cards,
  SUM(total_horas_semana) AS total_horas,
  jsonb_agg(
    jsonb_build_object(
      'id', id,
      'nome', nome,
      'area_nome', area_nome,
      'coluna', coluna,
      'completed_week', completed_week,
      'responsavel_nome', responsavel_nome,
      'horas_por_semana', horas_por_semana,
      'total_horas_semana', total_horas_semana
    )
    ORDER BY nome
  ) AS cards
FROM base
GROUP BY semana
ORDER BY semana;

GRANT SELECT ON public.pastelaria_gantt_semanas TO anon, authenticated;
