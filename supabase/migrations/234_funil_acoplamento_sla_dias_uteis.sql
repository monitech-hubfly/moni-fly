-- Funil Acoplamento: SLA por fase em dias úteis (coluna kanban_fases.sla_dias).
-- O Hub interpreta sla_dias como dias úteis (fins de semana e feriados nacionais fora)
-- via src/lib/dias-uteis.ts e calcularSlaKanbanCard em kanban-card-sla.ts.

UPDATE public.kanban_fases kf
SET sla_dias = v.sla_dias
FROM public.kanbans k
CROSS JOIN (VALUES
  ('modelagem_terreno', 1),
  ('modelagem_casa_gbox', 2),
  ('validacao_acoplamento', 1),
  ('alteracoes_acoplamento', 1)
) AS v(slug, sla_dias)
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Acoplamento'
  AND kf.slug = v.slug;
