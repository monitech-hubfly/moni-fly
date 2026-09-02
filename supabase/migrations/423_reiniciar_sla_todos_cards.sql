-- 423: Reinicia contagem de SLA em todos os cards ativos de todos os funis/kanbans.
-- Base do SLA no app: sla_iniciado_em > entered_fase_at > created_at (kanban-card-sla.ts).
-- Exclui cards arquivados e concluídos. Crédito Obra (co_documentacao_alvara) mantém SLA pausado
-- enquanto faltar alvara_url ou docs_terreno_url.
-- Legado processo_step_one sem kanban_cards: created_at = now() (board usa created_at como fallback).

-- PASSO 1 — Cards nativos ativos: reiniciar base do SLA
UPDATE public.kanban_cards c
SET
  sla_iniciado_em = now(),
  entered_fase_at = now(),
  sla_dias_acumulados = 0,
  updated_at = now()
WHERE COALESCE(c.arquivado, false) = false
  AND COALESCE(c.concluido, false) = false;

-- PASSO 2 — Crédito Obra: SLA pausado enquanto documentação incompleta
UPDATE public.kanban_cards c
SET sla_iniciado_em = NULL
FROM public.kanban_fases f
WHERE c.fase_id = f.id
  AND f.slug = 'co_documentacao_alvara'
  AND COALESCE(c.arquivado, false) = false
  AND COALESCE(c.concluido, false) = false
  AND (
    COALESCE(trim(c.alvara_url), '') = ''
    OR COALESCE(trim(c.docs_terreno_url), '') = ''
  );

-- PASSO 3 — Legado-only: processos visíveis sem linha em kanban_cards
UPDATE public.processo_step_one p
SET
  created_at = now(),
  updated_at = now()
WHERE p.cancelado_em IS NULL
  AND p.removido_em IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = p.id);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('423', 'reiniciar_sla_todos_cards')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
