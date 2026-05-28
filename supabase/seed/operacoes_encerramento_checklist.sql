-- Seed: checklist de encerramento na fase operacoes_entregue (Funil Operações).
-- Idempotente por fase_id + label. PROD: fase operacoes_entregue = 5b85ac83-a546-4c1d-9bf0-e5e40cf3d937

WITH fase AS (
  SELECT id FROM public.kanban_fases
  WHERE id = '5b85ac83-a546-4c1d-9bf0-e5e40cf3d937'
  LIMIT 1
)
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT fase.id, item.ordem, item.label, 'checkbox', true, false
FROM fase
CROSS JOIN (VALUES
  (1, 'Casa vendida e escriturada'),
  (2, 'Pagamento ao terrenista concluído (% VGV ou saldo)'),
  (3, 'Pagamento das taxas Moní concluído'),
  (4, 'Resultado distribuído ao franqueado'),
  (5, 'SPE encerrada (CNPJ baixado ou em processo de baixa)'),
  (6, 'Documentação arquivada no Drive'),
  (7, 'Caso registrado na biblioteca de estudos reais')
) AS item(ordem, label)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_fase_checklist_itens ci
  WHERE ci.fase_id = fase.id AND ci.label = item.label
);
