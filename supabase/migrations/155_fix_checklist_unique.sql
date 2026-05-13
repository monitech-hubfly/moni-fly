-- Prevenir duplicatas em kanban_fase_checklist_itens
DELETE FROM public.kanban_fase_checklist_itens a
USING public.kanban_fase_checklist_itens b
WHERE a.id > b.id
  AND a.fase_id = b.fase_id
  AND a.ordem = b.ordem
  AND a.label = b.label;

ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_fase_ordem_unique;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_fase_ordem_unique
  UNIQUE (fase_id, ordem, label);
