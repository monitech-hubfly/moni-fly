-- Backfill opcional para migrations 225/226 (rodar manualmente no SQL Editor se necessário).
-- Idempotente: só preenche linhas ainda vazias.

-- ─── 225: time_abertura_nome (set-based, sem subconsultas correlacionadas) ──
WITH topic_interacao AS (
  SELECT DISTINCT ON (st.interacao_id)
    st.interacao_id,
    kt.nome AS time_nome
  FROM public.sirene_topicos st
  JOIN public.kanban_times kt ON kt.id = ANY (st.times_ids)
  WHERE st.interacao_id IS NOT NULL
    AND COALESCE(array_length(st.times_ids, 1), 0) > 0
  ORDER BY st.interacao_id, st.ordem NULLS LAST, st.id
),
topic_chamado AS (
  SELECT DISTINCT ON (st.chamado_id)
    st.chamado_id,
    kt.nome AS time_nome
  FROM public.sirene_topicos st
  JOIN public.kanban_times kt ON kt.id = ANY (st.times_ids)
  WHERE st.chamado_id IS NOT NULL
    AND COALESCE(array_length(st.times_ids, 1), 0) > 0
  ORDER BY st.chamado_id, st.ordem NULLS LAST, st.id
),
calc AS (
  SELECT
    ka.id,
    COALESCE(
      NULLIF(TRIM(ka.time_abertura_nome), ''),
      NULLIF(TRIM(sc.time_abertura), ''),
      ti.time_nome,
      tc.time_nome
    ) AS new_time
  FROM public.kanban_atividades ka
  JOIN public.sirene_chamados sc ON ka.sirene_chamado_id = sc.id
  LEFT JOIN topic_interacao ti ON ti.interacao_id = ka.id
  LEFT JOIN topic_chamado tc ON tc.chamado_id = ka.sirene_chamado_id
  WHERE ka.origem = 'sirene'
    AND (ka.time_abertura_nome IS NULL OR TRIM(ka.time_abertura_nome) = '')
)
UPDATE public.kanban_atividades ka
SET time_abertura_nome = calc.new_time
FROM calc
WHERE ka.id = calc.id
  AND calc.new_time IS NOT NULL;

-- ─── 226: numero (caso migrations tenham rodado só com schema) ────────────────
UPDATE public.kanban_atividades ka
SET numero = sc.numero
FROM public.sirene_chamados sc
WHERE ka.sirene_chamado_id = sc.id
  AND ka.numero IS NULL
  AND sc.numero IS NOT NULL;

WITH base AS (
  SELECT COALESCE(
    GREATEST(
      (SELECT MAX(numero) FROM public.sirene_chamados),
      (SELECT MAX(numero) FROM public.kanban_atividades WHERE numero IS NOT NULL),
      0
    ),
    0
  ) AS max_num
),
pendentes AS (
  SELECT
    ka.id,
    ROW_NUMBER() OVER (ORDER BY ka.created_at NULLS LAST, ka.id) AS rn
  FROM public.kanban_atividades ka
  WHERE ka.origem = 'sirene'
    AND ka.numero IS NULL
)
UPDATE public.kanban_atividades ka
SET numero = base.max_num + pendentes.rn
FROM pendentes
CROSS JOIN base
WHERE ka.id = pendentes.id;

SELECT setval(
  'public.sirene_numero_seq',
  GREATEST(
    COALESCE((SELECT MAX(numero) FROM public.sirene_chamados), 0),
    COALESCE((SELECT MAX(numero) FROM public.kanban_atividades), 0),
    COALESCE((SELECT last_value FROM public.sirene_numero_seq), 0)
  )
);
