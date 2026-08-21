-- 264 instruções completas (opcional) — capital_informacoes_obrigatorias
UPDATE public.kanban_fases
SET instrucoes = $instr$Além dos materiais do projeto, informe:
• Nome da oferta
• CNPJ da SPE (obtido na etapa Abertura da SPE)
• Valor-alvo de captação (múltiplo de R$ 10)
• Valor mínimo de investimento por CPF (múltiplo de R$ 10)

Limite: até 50 investidores por oferta.$instr$
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_informacoes_obrigatorias';
