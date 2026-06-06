-- Reinicia contagem de SLA e remove atrasos de follow-up em todos os funis.
-- O board usa sla_iniciado_em (se preenchido) em vez de created_at — não altera created_at.
--
-- Escopo: cards ativos, não arquivados, não concluídos.
-- Exceção: fase co_documentacao_alvara sem documentos → SLA permanece pausado (sla_iniciado_em NULL).
--
-- SQL Editor: rode PASSO 1 (preview), depois PASSO 2, PASSO 3 e PASSO 4. Confira com PASSO 5.

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 1 — Preview (quantos serão afetados)
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  k.nome AS kanban,
  count(*) AS cards
FROM public.kanban_cards c
JOIN public.kanbans k ON k.id = c.kanban_id
WHERE c.status = 'ativo'
  AND c.arquivado = false
  AND c.concluido = false
GROUP BY k.nome
ORDER BY k.nome;

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 2 — Reiniciar SLA nos cards nativos (todos os kanbans)
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.kanban_cards c
SET
  sla_iniciado_em = now(),
  entered_fase_at = now(),
  sla_dias_acumulados = 0,
  data_followup = NULL,
  updated_at = now()
WHERE c.status = 'ativo'
  AND c.arquivado = false
  AND c.concluido = false;

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 3 — Crédito Obra: manter SLA pausado enquanto faltar documentação
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.kanban_cards c
SET sla_iniciado_em = NULL
FROM public.kanban_fases f
WHERE c.fase_id = f.id
  AND f.slug = 'co_documentacao_alvara'
  AND c.status = 'ativo'
  AND c.arquivado = false
  AND c.concluido = false
  AND (
    coalesce(trim(c.alvara_url), '') = ''
    OR coalesce(trim(c.docs_terreno_url), '') = ''
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 4 — Follow-up em processos legados (processo_step_one)
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.processo_step_one
SET
  data_followup = NULL,
  updated_at = now()
WHERE data_followup IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 5 — Conferência (cards ainda “atrasados” pelo SLA da fase)
-- Esperado: 0 ou só fases sem sla_dias / crédito obra aguardando doc
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  k.nome AS kanban,
  f.nome AS fase,
  count(*) AS ainda_com_base_antiga
FROM public.kanban_cards c
JOIN public.kanbans k ON k.id = c.kanban_id
JOIN public.kanban_fases f ON f.id = c.fase_id
WHERE c.status = 'ativo'
  AND c.arquivado = false
  AND c.concluido = false
  AND c.sla_iniciado_em IS NULL
  AND f.slug <> 'co_documentacao_alvara'
  AND coalesce(f.sla_dias, 0) > 0
  AND c.created_at < (now() - interval '1 day')
GROUP BY k.nome, f.nome
ORDER BY k.nome, f.nome;
