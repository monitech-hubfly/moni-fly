-- 326: Checklist Pré Batalha — label inclui Preço (três eixos: Lote + Preço + Produto).

UPDATE public.kanban_fase_checklist_itens i
SET label = 'Pré-batalha aplicada (Lote + Preço + Produto)'
WHERE label = 'Pré-batalha aplicada (Produto + Localização)'
  AND fase_id IN (
    SELECT f.id
    FROM public.kanban_fases f
    JOIN public.kanbans k ON k.id = f.kanban_id
    WHERE f.slug IN ('batalha', 'stepone_batalha')
      AND COALESCE(f.ativo, true) = true
      AND (
        k.id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
        OR (k.nome = 'Funil Step One' AND COALESCE(k.ativo, true) = true)
      )
  );

NOTIFY pgrst, 'reload schema';
