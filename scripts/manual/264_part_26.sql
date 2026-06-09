-- 264 part 26: instrução placeholder — capital_formalizacao
UPDATE public.kanban_fases
SET instrucoes = '—'
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_formalizacao';
