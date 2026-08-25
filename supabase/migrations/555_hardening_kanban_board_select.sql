-- 555: Hardening pós-outage dos boards (colunas opcionais + cards órfãos).
-- 1) Recria obra_ok (migration 546) para selects legados não quebrarem o PostgREST.
-- 2) Remapeia cards ativos visíveis com fase_id inválida para a 1ª fase ativa do kanban.
-- Idempotente.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS obra_ok boolean DEFAULT false;

COMMENT ON COLUMN public.kanban_cards.obra_ok IS
  'Flag legada de esteira (Funil Obra separado removido). Mantida para compatibilidade de SELECT.';

-- Cards ativos não arquivados/concluídos com fase inexistente ficam invisíveis no board.
UPDATE public.kanban_cards c
SET fase_id = (
  SELECT f.id
  FROM public.kanban_fases f
  WHERE f.kanban_id = c.kanban_id
    AND f.ativo IS DISTINCT FROM false
  ORDER BY f.ordem ASC NULLS LAST
  LIMIT 1
)
WHERE c.status = 'ativo'
  AND COALESCE(c.arquivado, false) = false
  AND COALESCE(c.concluido, false) = false
  AND (
    c.fase_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.kanban_fases f2 WHERE f2.id = c.fase_id
    )
  )
  AND EXISTS (
    SELECT 1
    FROM public.kanban_fases f3
    WHERE f3.kanban_id = c.kanban_id
      AND f3.ativo IS DISTINCT FROM false
  );

NOTIFY pgrst, 'reload schema';
