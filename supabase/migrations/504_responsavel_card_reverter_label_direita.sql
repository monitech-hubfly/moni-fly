-- 504: Reverte label do checklist responsavel_fase → «Responsável do card» (painel direito).
-- «Criador do Card» permanece só no painel esquerdo (Dados do Franqueado), sem item de checklist.

UPDATE public.kanban_fase_checklist_itens
SET label = 'Responsável do card'
WHERE campo_slug = 'responsavel_fase'
   OR trim(label) = 'Criador do Card';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('504', 'responsavel_card_reverter_label_direita')
ON CONFLICT (version) DO NOTHING;
