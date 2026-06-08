-- Reinicia contagem de SLA e remove atrasos de follow-up em todos os funis.
--
-- ⚠️ PRÉ-REQUISITO (obrigatório se o board “voltou” com atrasos antigos):
--    Rode primeiro scripts/manual/apply_sla_columns_213_229.sql no MESMO banco.
--    Sem entered_fase_at / sla_iniciado_em o reset e o deploy não surtem efeito.
--
-- O board usa: sla_iniciado_em > entered_fase_at > created_at (ver kanban-card-sla.ts).

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 1 — Diagnóstico: cards ainda com base antiga (>30 d.u. estimados)
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  k.nome AS kanban,
  c.titulo,
  c.created_at,
  c.entered_fase_at,
  c.sla_iniciado_em,
  CASE
    WHEN c.sla_iniciado_em IS NOT NULL THEN 'sla_iniciado_em'
    WHEN c.entered_fase_at IS NOT NULL THEN 'entered_fase_at'
    ELSE 'created_at'
  END AS base_sla_atual
FROM public.kanban_cards c
JOIN public.kanbans k ON k.id = c.kanban_id
WHERE c.arquivado = false
  AND c.concluido = false
  AND coalesce(c.created_at, now() - interval '999 days') < (now() - interval '30 days')
  AND coalesce(c.entered_fase_at, c.sla_iniciado_em, c.created_at) < (now() - interval '7 days')
ORDER BY k.nome, c.created_at
LIMIT 50;

-- Processos legado-only (sem linha em kanban_cards)
SELECT count(*) AS processos_legado_sem_kanban_card
FROM public.processo_step_one p
WHERE p.cancelado_em IS NULL
  AND p.removido_em IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = p.id);

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 2 — Reiniciar SLA nos cards nativos (TODOS os kanbans, sem filtro status)
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.kanban_cards c
SET
  sla_iniciado_em = now(),
  entered_fase_at = now(),
  sla_dias_acumulados = 0,
  data_followup = NULL,
  updated_at = now()
WHERE c.arquivado = false
  AND c.concluido = false;

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 3 — Crédito Obra: manter SLA pausado enquanto faltar documentação
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.kanban_cards c
SET sla_iniciado_em = NULL
FROM public.kanban_fases f
WHERE c.fase_id = f.id
  AND f.slug = 'co_documentacao_alvara'
  AND c.arquivado = false
  AND c.concluido = false
  AND (
    coalesce(trim(c.alvara_url), '') = ''
    OR coalesce(trim(c.docs_terreno_url), '') = ''
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 4 — Legado-only: processos visíveis no board sem kanban_cards
-- (o board usa processo.created_at quando não há entered_fase_at)
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.processo_step_one p
SET
  created_at = now(),
  data_followup = NULL,
  updated_at = now()
WHERE p.cancelado_em IS NULL
  AND p.removido_em IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = p.id);

-- Follow-up em processos que também têm kanban_cards (já limpo no PASSO 2 em kanban_cards)
UPDATE public.processo_step_one
SET data_followup = NULL, updated_at = now()
WHERE data_followup IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 5 — Conferência
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  k.nome AS kanban,
  count(*) AS cards_ativos,
  count(*) FILTER (
    WHERE coalesce(c.entered_fase_at, c.sla_iniciado_em, c.created_at) >= (now() - interval '1 day')
  ) AS sla_reiniciado_hoje
FROM public.kanban_cards c
JOIN public.kanbans k ON k.id = c.kanban_id
WHERE c.arquivado = false AND c.concluido = false
GROUP BY k.nome
ORDER BY k.nome;
