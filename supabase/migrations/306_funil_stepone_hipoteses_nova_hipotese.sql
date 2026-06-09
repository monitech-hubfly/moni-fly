-- 306: Funil Step One — renomear fase «Hipóteses» para «Nova Hipótese».

UPDATE public.kanban_fases
SET nome = 'Nova Hipótese'
WHERE kanban_id IN (
    SELECT id FROM public.kanbans
    WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
       OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  )
  AND (
    slug IN ('hipoteses', 'stepone_hipoteses')
    OR nome = 'Hipóteses'
  )
  AND COALESCE(ativo, true) = true;
