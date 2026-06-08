-- 282: Recupera data_followup após reset acidental (ex.: reset_sla_todos_cards.sql).
-- Idempotente: só preenche cards ativos sem follow-up quando há fonte confiável.

-- PASSO A — Copiar de outro card do mesmo franqueado (inclui arquivados/concluídos).
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

-- PASSO B — Espelhar em processo_step_one ligado ao card.
UPDATE public.processo_step_one p
SET
  data_followup = k.data_followup,
  updated_at = now()
FROM public.kanban_cards k
WHERE p.data_followup IS NULL
  AND k.data_followup IS NOT NULL
  AND (
    p.id = k.id
    OR (
      p.origem_rede_franqueados_id IS NOT NULL
      AND p.origem_rede_franqueados_id = k.rede_franqueado_id
    )
  );

-- PASSO C — Fallback: prazo mais recente nas atas (ISO yyyy-mm-dd) para cards ainda vazios.
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
