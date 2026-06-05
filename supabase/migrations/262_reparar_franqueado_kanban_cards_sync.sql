-- 262: Repara rede_franqueado_id perdido em grupos de sync (vínculos + origem_card_id).
-- Nunca sobrescreve valor existente; só preenche cards com NULL a partir de parceiro do grupo.

-- Cadeia origem_card_id (pais → filhos)
DO $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..32 LOOP
    UPDATE kanban_cards
    SET rede_franqueado_id = pai.rede_franqueado_id
    FROM kanban_cards pai
    WHERE kanban_cards.origem_card_id = pai.id
      AND kanban_cards.rede_franqueado_id IS NULL
      AND pai.rede_franqueado_id IS NOT NULL;
  END LOOP;
END $$;

-- Vínculos bidirecionais em kanban_card_vinculos
DO $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..16 LOOP
    UPDATE kanban_cards
    SET rede_franqueado_id = fonte.rede_franqueado_id
    FROM kanban_card_vinculos v
    JOIN kanban_cards fonte ON fonte.id = v.card_origem_id
    WHERE kanban_cards.id = v.card_destino_id
      AND kanban_cards.rede_franqueado_id IS NULL
      AND fonte.rede_franqueado_id IS NOT NULL;

    UPDATE kanban_cards
    SET rede_franqueado_id = fonte.rede_franqueado_id
    FROM kanban_card_vinculos v
    JOIN kanban_cards fonte ON fonte.id = v.card_destino_id
    WHERE kanban_cards.id = v.card_origem_id
      AND kanban_cards.rede_franqueado_id IS NULL
      AND fonte.rede_franqueado_id IS NOT NULL;
  END LOOP;
END $$;

-- Espelha em processo_step_one quando origem_rede foi zerada indevidamente
UPDATE processo_step_one
SET
  origem_rede_franqueados_id = k.rede_franqueado_id,
  numero_franquia = coalesce(processo_step_one.numero_franquia, rf.n_franquia),
  updated_at = now()
FROM kanban_cards k
JOIN rede_franqueados rf ON rf.id = k.rede_franqueado_id
WHERE processo_step_one.origem_rede_franqueados_id IS NULL
  AND k.rede_franqueado_id IS NOT NULL
  AND (
    processo_step_one.id = k.id
    OR processo_step_one.id = k.projeto_id
    OR k.projeto_id = processo_step_one.id
  );
