-- 264 part 28: instrução placeholder — capital_nao_elegivel
UPDATE public.kanban_fases
SET instrucoes = '—'
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_nao_elegivel';
