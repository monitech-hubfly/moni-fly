-- 407: Tag padronizada «⭐Especial» (dourada) em todos os funis/kanbans.

INSERT INTO public.kanban_tags (kanban_id, nome, cor)
SELECT
  k.id,
  '⭐Especial',
  '#D4AD68'
FROM public.kanbans k
WHERE NOT EXISTS (
  SELECT 1
  FROM public.kanban_tags t
  WHERE t.kanban_id = k.id
    AND t.nome = '⭐Especial'
);

UPDATE public.kanban_tags
SET cor = '#D4AD68'
WHERE nome = '⭐Especial';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('407', 'kanban_tag_especial_todos_funis')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
