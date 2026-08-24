-- 553: Remover Funil Pré Obra e Funil Obra separados (migration 545–547).
-- O fluxo operacional permanece no Funil Pré Obra e Obra (OPERACOES / /operacoes).
-- UUIDs: Pré Obra 91686091-077d-479d-bbb3-cb062ded286e | Obra 8b25508c-afdc-4a44-84a8-36c4fcf8cb4b

DO $$
DECLARE
  kid_pre uuid := '91686091-077d-479d-bbb3-cb062ded286e'::uuid;
  kid_obra uuid := '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b'::uuid;
BEGIN
  -- Checklist respostas → itens → cards → fases → kanbans
  DELETE FROM public.kanban_fase_checklist_respostas
  WHERE item_id IN (
    SELECT i.id
    FROM public.kanban_fase_checklist_itens i
    JOIN public.kanban_fases f ON f.id = i.fase_id
    WHERE f.kanban_id IN (kid_pre, kid_obra)
  );

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id IN (
    SELECT id FROM public.kanban_fases WHERE kanban_id IN (kid_pre, kid_obra)
  );

  -- Cards: CASCADE em fases apagaria cards; apagar cards explicitamente primeiro
  DELETE FROM public.kanban_cards
  WHERE kanban_id IN (kid_pre, kid_obra);

  DELETE FROM public.kanban_fases
  WHERE kanban_id IN (kid_pre, kid_obra);

  DELETE FROM public.kanbans
  WHERE id IN (kid_pre, kid_obra)
     OR nome IN ('Funil Pré Obra', 'Funil Obra');
END $$;

ALTER TABLE public.kanban_cards
  DROP COLUMN IF EXISTS obra_ok;

NOTIFY pgrst, 'reload schema';
