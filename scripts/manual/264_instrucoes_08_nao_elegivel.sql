-- 264 instruções completas (opcional) — capital_nao_elegivel
UPDATE public.kanban_fases
SET instrucoes = $instr$Projeto não elegível para captação via Moní Capital. Registre o motivo e comunique o franqueado.$instr$
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_nao_elegivel';
