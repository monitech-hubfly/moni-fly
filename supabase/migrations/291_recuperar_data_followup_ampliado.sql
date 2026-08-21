-- 291: Recuperação ampliada de data_followup / data_reuniao (idempotente).
-- Complementa 282 quando todas as linhas ativas perderam a data mas ainda há fonte em
-- processo_step_one, cards arquivados/concluídos, rede/franqueado ou atas.

-- ── Follow-up: processo → kanban (mesmo id) ─────────────────────────────────
UPDATE public.kanban_cards k
SET
  data_followup = p.data_followup,
  updated_at = now()
FROM public.processo_step_one p
WHERE k.data_followup IS NULL
  AND p.data_followup IS NOT NULL
  AND k.id = p.id;

-- ── Follow-up: processo → kanban (projeto_id) ───────────────────────────────
UPDATE public.kanban_cards k
SET
  data_followup = p.data_followup,
  updated_at = now()
FROM public.processo_step_one p
WHERE k.data_followup IS NULL
  AND p.data_followup IS NOT NULL
  AND k.projeto_id IS NOT NULL
  AND k.projeto_id = p.id;

-- ── Follow-up: copiar de qualquer card do mesmo franqueado (rede), inclusive arquivado ──
UPDATE public.kanban_cards dest
SET
  data_followup = src.data_followup,
  updated_at = now()
FROM (
  SELECT
    rede_franqueado_id,
    max(data_followup) AS data_followup
  FROM public.kanban_cards
  WHERE data_followup IS NOT NULL
    AND rede_franqueado_id IS NOT NULL
  GROUP BY rede_franqueado_id
) src
WHERE dest.data_followup IS NULL
  AND dest.arquivado = false
  AND dest.concluido = false
  AND dest.rede_franqueado_id IS NOT NULL
  AND dest.rede_franqueado_id = src.rede_franqueado_id;

-- ── Follow-up: fallback por franqueado_id (user_id do card) ─────────────────
UPDATE public.kanban_cards dest
SET
  data_followup = src.data_followup,
  updated_at = now()
FROM (
  SELECT
    franqueado_id,
    max(data_followup) AS data_followup
  FROM public.kanban_cards
  WHERE data_followup IS NOT NULL
    AND franqueado_id IS NOT NULL
  GROUP BY franqueado_id
) src
WHERE dest.data_followup IS NULL
  AND dest.arquivado = false
  AND dest.concluido = false
  AND dest.franqueado_id IS NOT NULL
  AND dest.franqueado_id = src.franqueado_id;

-- ── Follow-up: prazos nas atas de reunião ───────────────────────────────────
WITH prazos_ata AS (
  SELECT
    a.card_id,
    max((elem.value->>'prazo')::date) AS data_followup
  FROM public.kanban_card_atas_reuniao a
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE jsonb_typeof(coalesce(a.conteudo::jsonb, '{}'::jsonb)->'acoes')
      WHEN 'array' THEN (coalesce(a.conteudo::jsonb, '{}'::jsonb)->'acoes')
      ELSE '[]'::jsonb
    END
  ) AS elem(value)
  WHERE EXISTS (
    SELECT 1 FROM public.kanban_cards c WHERE c.id = a.card_id
  )
    AND coalesce(trim(elem.value->>'prazo'), '') ~ '^\d{4}-\d{2}-\d{2}$'
  GROUP BY a.card_id
)
UPDATE public.kanban_cards c
SET
  data_followup = p.data_followup,
  updated_at = now()
FROM prazos_ata p
WHERE c.id = p.card_id
  AND c.data_followup IS NULL
  AND c.arquivado = false
  AND c.concluido = false
  AND p.data_followup IS NOT NULL;

-- ── Follow-up: espelhar kanban → processo ───────────────────────────────────
UPDATE public.processo_step_one p
SET
  data_followup = k.data_followup,
  updated_at = now()
FROM public.kanban_cards k
WHERE p.data_followup IS NULL
  AND k.data_followup IS NOT NULL
  AND (
    p.id = k.id
    OR (k.projeto_id IS NOT NULL AND p.id = k.projeto_id)
    OR (
      p.origem_rede_franqueados_id IS NOT NULL
      AND p.origem_rede_franqueados_id = k.rede_franqueado_id
    )
  );

-- ── Reunião: processo → kanban (mesmo id / projeto_id) ───────────────────────
UPDATE public.kanban_cards k
SET
  data_reuniao = p.data_reuniao,
  updated_at = now()
FROM public.processo_step_one p
WHERE k.data_reuniao IS NULL
  AND p.data_reuniao IS NOT NULL
  AND (k.id = p.id OR (k.projeto_id IS NOT NULL AND k.projeto_id = p.id));

UPDATE public.processo_step_one p
SET
  data_reuniao = k.data_reuniao,
  updated_at = now()
FROM public.kanban_cards k
WHERE p.data_reuniao IS NULL
  AND k.data_reuniao IS NOT NULL
  AND (
    p.id = k.id
    OR (k.projeto_id IS NOT NULL AND p.id = k.projeto_id)
  );
