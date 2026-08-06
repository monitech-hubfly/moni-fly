-- 503: Renomeia label do checklist «Responsável do card» → «Criador do Card».
-- Slug permanece responsavel_fase. Não altera itens responsavel_da_fase.

UPDATE kanban_fase_checklist_itens
SET label = 'Criador do Card'
WHERE campo_slug = 'responsavel_fase'
   OR trim(label) = 'Responsável do card';

NOTIFY pgrst, 'reload schema';
