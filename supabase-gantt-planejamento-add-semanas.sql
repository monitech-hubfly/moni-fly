-- Se você já criou a tabela gantt_planejamento antes e está com erro ao adicionar,
-- rode primeiro o script supabase-gantt-planejamento.sql (CREATE TABLE).
-- Se a tabela já existir sem as colunas de semana, rode este script no SQL Editor:
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS semana_inicio int;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS semana_fim int;
