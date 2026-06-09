-- 264 part 25: instrução placeholder — capital_informacoes_obrigatorias
UPDATE public.kanban_fases
SET instrucoes = '—'
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_informacoes_obrigatorias';
