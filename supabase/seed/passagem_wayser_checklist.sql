-- Seed: checklist ritual de passagem Wayser (fase passagem_wayser).
-- Idempotente por fase_id + label. Tipo checkbox (= boolean no app).
-- PROD: kanban Funil Portfólio id = c57120a0-991c-422b-8def-4d16a9411d45 (evita encoding do nome com acento).

WITH fase AS (
  SELECT id
  FROM public.kanban_fases
  WHERE kanban_id = 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid
    AND slug = 'passagem_wayser'
  LIMIT 1
)
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT fase.id, item.ordem, item.label, 'checkbox', true, false
FROM fase
CROSS JOIN (
  VALUES
    (1, 'Contrato de permuta assinado por todas as partes'),
    (2, 'SPE aberta com CNPJ e conta bancária'),
    (3, 'Pasta Drive organizada (01_STEP_ONE / 02_BCA / 03_BATALHAS / 04_COMITE / 05_JURIDICO)'),
    (4, 'Carta fiança estruturada'),
    (5, 'Ata da reunião de passagem assinada por Portfolio + Waysers + Frank'),
    (6, 'Franqueado com Casas 0, 1 e 2 da Universidade concluídas')
) AS item(ordem, label)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.kanban_fase_checklist_itens ci
  WHERE ci.fase_id = fase.id
    AND ci.label = item.label
);
