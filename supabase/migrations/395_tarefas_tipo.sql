-- Tipo de tarefa: Modelagem / Documentação
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS tipo text;
