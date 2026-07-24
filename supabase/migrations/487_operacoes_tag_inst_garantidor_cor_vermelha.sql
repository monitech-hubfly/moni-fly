-- 487: Garante cor vermelha da tag «Contratar Inst. Garantidor» no cadastro.

UPDATE public.kanban_tags
SET cor = '#c24b3a'
WHERE nome = 'Contratar Inst. Garantidor'
  AND cor IS DISTINCT FROM '#c24b3a';

NOTIFY pgrst, 'reload schema';
