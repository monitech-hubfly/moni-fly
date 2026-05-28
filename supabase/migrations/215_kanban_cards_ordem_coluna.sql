-- 215: ordem manual dos cards dentro de cada fase do kanban nativo

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS ordem_coluna INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.kanban_cards.ordem_coluna IS
  'Ordem de exibição do card na fase (menor = mais acima).';

CREATE INDEX IF NOT EXISTS idx_kanban_cards_fase_ordem
  ON public.kanban_cards (fase_id, ordem_coluna);

-- Backfill: preserva ordem atual (created_at DESC → menor ordem = mais recente no topo)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY fase_id ORDER BY created_at DESC, id) - 1 AS rn
  FROM public.kanban_cards
)
UPDATE public.kanban_cards k
SET ordem_coluna = r.rn
FROM ranked r
WHERE k.id = r.id;
