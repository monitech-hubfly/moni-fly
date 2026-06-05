-- 264 part 09: renomeio idempotente (pule se parts 02–07 já rodaram)
UPDATE public.kanban_fases kf
SET slug = 'capital_cadastro_plataforma'
WHERE kf.kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND kf.slug = 'capital_estruturacao'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf2
    WHERE kf2.kanban_id = kf.kanban_id AND kf2.slug = 'capital_cadastro_plataforma' AND kf2.id <> kf.id
  );
