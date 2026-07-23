-- 478: Adiciona coluna data (date) em gantt_planejamento
-- Usada pela Agenda para filtrar entradas por data específica
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS data date;
