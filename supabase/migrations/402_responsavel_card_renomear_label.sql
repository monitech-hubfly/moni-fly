-- 402: Renomeia label do checklist «Responsável da fase» → «Responsável do card».

UPDATE public.kanban_fase_checklist_itens
SET label = 'Responsável do card'
WHERE campo_slug = 'responsavel_fase'
   OR trim(label) = 'Responsável da fase';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('402', 'responsavel_card_renomear_label')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
