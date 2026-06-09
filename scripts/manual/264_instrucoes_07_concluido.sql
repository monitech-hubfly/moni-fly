-- 264 instruções completas (opcional) — capital_concluido
UPDATE public.kanban_fases
SET instrucoes = $instr$Oferta publicada. Acompanhe a captação e indique investidores qualificados (CPFs cadastrados na plataforma).$instr$
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_concluido';
