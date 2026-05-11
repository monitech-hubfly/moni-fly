-- Caneta verde por comportamento (tarefa = comportamento no Workload).
-- Rode no Supabase → SQL Editor.
ALTER TABLE tarefas
  ADD COLUMN IF NOT EXISTS caneta_verde text CHECK (caneta_verde IS NULL OR caneta_verde IN ('sim', 'nao'));
