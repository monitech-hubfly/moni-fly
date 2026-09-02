-- 264 part 01: garantir kanban Funil Moní Capital (1 statement)
INSERT INTO public.kanbans (nome, descricao, ativo)
SELECT 'Funil Moní Capital', 'Captação privada via plataforma Moní Capital', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans WHERE nome = 'Funil Moní Capital'
);
