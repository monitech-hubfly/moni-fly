-- 264 instruções completas (opcional) — capital_materiais_projeto
UPDATE public.kanban_fases
SET instrucoes = $instr$Envie os materiais que o investidor verá na oferta (logo, imagens, textos de apoio).

A Moní estrutura profissionalmente:
• Resumo da oferta
• Descrição
• Equipe (opcional)
• FAQ (opcional)
• Logo e cabeçalho
• Carrossel de imagens
• OnePager$instr$
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_materiais_projeto';
