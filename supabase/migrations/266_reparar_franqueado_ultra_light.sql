-- 266: Reparo rede_franqueado_id — 1 lote por statement (SQL Editor, sem DO/LOOP).
-- Copie e execute cada bloco separadamente; repita até a query de verificação retornar 0.
-- Ordem: 266a → repetir → 266b → repetir → 266c → repetir → 266d → repetir.
-- Manual completo: supabase/migrations/MANUAL_RUN_264_265.md

-- ══════════════════════════════════════════════════════════════════════════════
-- 266a — Índice (uma vez)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_kanban_cards_rede_null_origem
  ON public.kanban_cards (origem_card_id)
  WHERE rede_franqueado_id IS NULL AND origem_card_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- 266b — 1 lote origem_card_id (repita até pendentes_origem = 0)
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.kanban_cards filho
SET rede_franqueado_id = pai.rede_franqueado_id
FROM public.kanban_cards pai
WHERE filho.origem_card_id = pai.id
  AND filho.rede_franqueado_id IS NULL
  AND pai.rede_franqueado_id IS NOT NULL
  AND filho.id IN (
    SELECT f.id
    FROM public.kanban_cards f
    INNER JOIN public.kanban_cards p ON f.origem_card_id = p.id
    WHERE f.rede_franqueado_id IS NULL
      AND p.rede_franqueado_id IS NOT NULL
    LIMIT 100
  );

-- Verificação 266b
SELECT count(*) AS pendentes_origem
FROM public.kanban_cards f
INNER JOIN public.kanban_cards p ON f.origem_card_id = p.id
WHERE f.rede_franqueado_id IS NULL
  AND p.rede_franqueado_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- 266c1 — 1 lote vínculos origem→destino (repita até pendentes_vinculos = 0)
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.kanban_cards alvo
SET rede_franqueado_id = fonte.rede_franqueado_id
FROM public.kanban_card_vinculos v
JOIN public.kanban_cards fonte ON fonte.id = v.card_origem_id
WHERE alvo.id = v.card_destino_id
  AND alvo.rede_franqueado_id IS NULL
  AND fonte.rede_franqueado_id IS NOT NULL
  AND alvo.id IN (
    SELECT k.id
    FROM public.kanban_cards k
    JOIN public.kanban_card_vinculos vv ON k.id = vv.card_destino_id
    JOIN public.kanban_cards fo ON fo.id = vv.card_origem_id
    WHERE k.rede_franqueado_id IS NULL
      AND fo.rede_franqueado_id IS NOT NULL
    LIMIT 100
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 266c2 — 1 lote vínculos destino→origem (alterne com 266c1)
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.kanban_cards alvo
SET rede_franqueado_id = fonte.rede_franqueado_id
FROM public.kanban_card_vinculos v
JOIN public.kanban_cards fonte ON fonte.id = v.card_destino_id
WHERE alvo.id = v.card_origem_id
  AND alvo.rede_franqueado_id IS NULL
  AND fonte.rede_franqueado_id IS NOT NULL
  AND alvo.id IN (
    SELECT k.id
    FROM public.kanban_cards k
    JOIN public.kanban_card_vinculos vv ON k.id = vv.card_origem_id
    JOIN public.kanban_cards fo ON fo.id = vv.card_destino_id
    WHERE k.rede_franqueado_id IS NULL
      AND fo.rede_franqueado_id IS NOT NULL
    LIMIT 100
  );

-- Verificação 266c
SELECT count(*) AS pendentes_vinculos
FROM public.kanban_cards k
JOIN public.kanban_card_vinculos vv
  ON k.id = vv.card_destino_id OR k.id = vv.card_origem_id
JOIN public.kanban_cards fo
  ON fo.id = CASE WHEN k.id = vv.card_destino_id THEN vv.card_origem_id ELSE vv.card_destino_id END
WHERE k.rede_franqueado_id IS NULL
  AND fo.rede_franqueado_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- 266d — 1 lote processo_step_one (repita até pendentes_processo = 0)
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.processo_step_one ps
SET
  origem_rede_franqueados_id = batch.rede_franqueado_id,
  numero_franquia = coalesce(ps.numero_franquia, batch.n_franquia),
  updated_at = now()
FROM (
  SELECT
    ps2.id,
    k.rede_franqueado_id,
    rf.n_franquia
  FROM public.processo_step_one ps2
  JOIN public.kanban_cards k ON (
    ps2.id = k.id
    OR ps2.id = k.projeto_id
    OR k.projeto_id = ps2.id
  )
  JOIN public.rede_franqueados rf ON rf.id = k.rede_franqueado_id
  WHERE ps2.origem_rede_franqueados_id IS NULL
    AND k.rede_franqueado_id IS NOT NULL
  LIMIT 100
) batch
WHERE ps.id = batch.id;

-- Verificação 266d
SELECT count(*) AS pendentes_processo
FROM public.processo_step_one ps2
JOIN public.kanban_cards k ON (
  ps2.id = k.id OR ps2.id = k.projeto_id OR k.projeto_id = ps2.id
)
WHERE ps2.origem_rede_franqueados_id IS NULL
  AND k.rede_franqueado_id IS NOT NULL;
