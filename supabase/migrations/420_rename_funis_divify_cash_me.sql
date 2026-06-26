-- 420: Renomear funis Moní Capital → Divify e Crédito Obra → Cash Me.

UPDATE public.kanbans
SET nome = 'Funil Divify'
WHERE nome = 'Funil Moní Capital';

UPDATE public.kanbans
SET nome = 'Funil Cash Me'
WHERE nome IN ('Funil Crédito Obra', 'Funil Crédito');
