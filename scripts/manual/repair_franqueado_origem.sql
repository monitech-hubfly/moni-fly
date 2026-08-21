-- 1 lote: propaga rede_franqueado_id pai → filho (LIMIT 25). Repita até pendentes_origem = 0.
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
    LIMIT 25
  );
