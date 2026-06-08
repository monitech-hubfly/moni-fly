-- Recuperação de data_followup após apagamento em massa.
--
-- Causa mais comum: scripts/manual/reset_sla_todos_cards.sql (PASSO 2/4 zera follow-ups).
-- Este script é idempotente — rode PASSO 0 (diagnóstico), depois PASSO 1–3.
--
-- Se PASSO 1–3 não recuperar tudo: use backup/PITR do Supabase
-- (Dashboard → Database → Backups) e exporte data_followup de um snapshot anterior.

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 0 — Diagnóstico
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  k.nome AS kanban,
  count(*) FILTER (WHERE c.data_followup IS NOT NULL) AS com_followup,
  count(*) FILTER (WHERE c.data_followup IS NULL) AS sem_followup
FROM public.kanban_cards c
JOIN public.kanbans k ON k.id = c.kanban_id
WHERE c.arquivado = false
  AND c.concluido = false
GROUP BY k.nome
ORDER BY k.nome;

SELECT count(*) AS historico_alteracao_followup
FROM public.kanban_historico kh
WHERE kh.acao = 'campo_alterado'
  AND kh.detalhe->'campos' @> '[{"campo":"data_followup"}]'::jsonb;

-- Cards arquivados/concluídos que ainda têm data (fonte de recuperação)
SELECT count(*) AS cards_com_followup_em_qualquer_status
FROM public.kanban_cards
WHERE data_followup IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 1 — Copiar de outro card do mesmo franqueado (rede_franqueado_id)
-- ══════════════════════════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 2 — Espelhar em processo_step_one
-- ══════════════════════════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 3 — Fallback: prazos de ações nas atas (yyyy-mm-dd)
-- ══════════════════════════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 4 — Conferência
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  k.nome AS kanban,
  count(*) FILTER (WHERE c.data_followup IS NOT NULL) AS com_followup,
  count(*) FILTER (WHERE c.data_followup IS NULL) AS sem_followup
FROM public.kanban_cards c
JOIN public.kanbans k ON k.id = c.kanban_id
WHERE c.arquivado = false
  AND c.concluido = false
GROUP BY k.nome
ORDER BY k.nome;
