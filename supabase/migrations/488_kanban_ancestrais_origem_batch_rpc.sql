-- 488: RPC para resolver cadeia de origem_card_id em uma única query recursiva.
-- Substitui o while-loop em coletarCadeiaOrigemAncestraisBatch (kanban-paralelas-chips.ts).
-- Retorna todos os pares (board_card_id, ancestral_id) para um conjunto de card IDs.
-- Zero impacto em dados — é apenas leitura.

CREATE OR REPLACE FUNCTION kanban_ancestrais_origem_batch(card_ids uuid[])
RETURNS TABLE(board_card_id uuid, ancestral_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH RECURSIVE cadeia AS (
    -- Base: todos os cards do board com seus pais diretos
    SELECT
      kc.id          AS board_id,
      kc.id          AS cur_id,
      kc.origem_card_id AS next_id
    FROM kanban_cards kc
    WHERE kc.id = ANY(card_ids)

    UNION

    -- Sobe: pai do pai, até não haver mais (origem_card_id IS NULL para o JOIN não unir)
    SELECT
      c.board_id,
      kc.id,
      kc.origem_card_id
    FROM cadeia c
    JOIN kanban_cards kc ON kc.id = c.next_id
  )
  SELECT DISTINCT board_id AS board_card_id, cur_id AS ancestral_id
  FROM cadeia
  WHERE cur_id <> board_id;   -- exclui o próprio card (só ancestrais)
$$;

NOTIFY pgrst, 'reload schema';
