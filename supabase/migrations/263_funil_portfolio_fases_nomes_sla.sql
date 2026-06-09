-- Funil Portfólio: nomes de exibição e SLA em dias úteis (kanban_fases.sla_dias).
-- Slugs inalterados (step_2, step_3, …). O Hub interpreta sla_dias como dias úteis
-- via src/lib/dias-uteis.ts e calcularSlaKanbanCard em kanban-card-sla.ts.

UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  sla_dias = v.sla_dias
FROM public.kanbans k
CROSS JOIN (VALUES
  ('step_2',                    'Novo Negócio',                  2),
  ('aprovacao_moni_novo_negocio','Aprovação Moní - Novo Negócio', 2),
  ('step_3',                    'Opção',                         3),
  ('step_4',                    'Check Legal e Crédito',         3),
  ('acoplamento',               'Acoplamento',                   5),
  ('step_5',                    'Comitê',                        5),
  ('step_6',                    'Diligência',                   10),
  ('step_7',                    'Contrato',                      3),
  ('captacao_moni_capital',     'Captação Moní Capital',        30),
  ('passagem_wayser',           'Passagem para Wayser',          2)
) AS v(slug, nome, sla_dias)
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Portfólio'
  AND kf.slug = v.slug;
