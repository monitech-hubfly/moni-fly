-- 383: Funil Step One — responsável da fase = franqueado do card (fase atual).

WITH alvos AS (
  SELECT
    c.id AS card_id,
    i.id AS item_id,
    c.franqueado_id::text AS user_id
  FROM public.kanban_cards c
  INNER JOIN public.kanban_fase_checklist_itens i
    ON i.fase_id = c.fase_id
   AND i.campo_slug = 'responsavel_fase'
  WHERE c.kanban_id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
    AND c.franqueado_id IS NOT NULL
)
INSERT INTO public.kanban_fase_checklist_respostas (
  item_id,
  card_id,
  valor,
  preenchido_em
)
SELECT
  a.item_id,
  a.card_id,
  a.user_id,
  NOW()
FROM alvos a
ON CONFLICT (item_id, card_id) DO UPDATE
SET
  valor = EXCLUDED.valor,
  preenchido_em = EXCLUDED.preenchido_em;
