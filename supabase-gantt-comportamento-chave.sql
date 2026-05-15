-- Coluna para marcar comportamento como chave no planejamento Gantt
-- Execute no Supabase (SQL Editor) para habilitar a seleção na tabela do Carômetro
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS comportamento_chave boolean DEFAULT false;
