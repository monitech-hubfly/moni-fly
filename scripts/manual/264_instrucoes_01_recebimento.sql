-- 264 instruções completas (opcional) — capital_recebimento
UPDATE public.kanban_fases
SET instrucoes = $instr$Card recebido da esteira Portfólio (Captação Moní Capital). Confira elegibilidade e encaminhe para Abertura da SPE quando o franqueado estiver pronto para estruturar a oferta.$instr$
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_recebimento';
