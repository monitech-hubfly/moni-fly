-- 264 part 22: instrução placeholder — capital_abertura_spe
UPDATE public.kanban_fases
SET instrucoes = '—'
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_abertura_spe';
