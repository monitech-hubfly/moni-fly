-- Quantos cards ainda faltam reparar via origem_card_id
SELECT count(*) AS pendentes_origem
FROM public.kanban_cards f
INNER JOIN public.kanban_cards p ON f.origem_card_id = p.id
WHERE f.rede_franqueado_id IS NULL
  AND p.rede_franqueado_id IS NOT NULL;
