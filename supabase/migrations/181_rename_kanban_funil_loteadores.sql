-- 181: Renomear kanban «Funil Moní INC» → «Funil Loteadores» (rótulo e registro em produção).
UPDATE public.kanbans
SET
  nome = 'Funil Loteadores',
  descricao = 'Funil de qualificação — loteadores'
WHERE nome = 'Funil Moní INC';
