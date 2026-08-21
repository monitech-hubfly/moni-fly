-- Permite guardar quais semanas do trimestre foram selecionadas para cada atividade.
-- Rode no Supabase → SQL Editor (uma vez).
ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS semanas_selecionadas int[] DEFAULT '{}';
