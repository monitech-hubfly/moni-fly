-- 264 instruções completas (opcional) — capital_formalizacao
UPDATE public.kanban_fases
SET instrucoes = $instr$A Moní prepara o contrato para assinatura.

Taxa de R$ 2.500 para subida da oferta.

Após assinatura e pagamento, a oferta é publicada com agendamento mínimo de 1 hora.$instr$
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_formalizacao';
