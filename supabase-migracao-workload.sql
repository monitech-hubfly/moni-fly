-- Migração: Workload com Trimestre/Objetivos e Cronograma por semana
-- Rode no Supabase → SQL Editor (pode colar e executar tudo de uma vez).
-- Necessário para: vínculo tarefa→objetivo (META), matriz de semanas e GANTT na tela Workload.

-- 1) Tarefas: vínculo com objetivo (META) e campos de tempo/periodicidade
ALTER TABLE tarefas
  ADD COLUMN IF NOT EXISTS objetivo_id uuid REFERENCES objetivos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsavel text,
  ADD COLUMN IF NOT EXISTS periodicidade text,
  ADD COLUMN IF NOT EXISTS horas_semanais numeric;

-- 2) Ações: campos de tempo/periodicidade e caneta verde
ALTER TABLE acoes
  ADD COLUMN IF NOT EXISTS responsavel text,
  ADD COLUMN IF NOT EXISTS periodicidade text,
  ADD COLUMN IF NOT EXISTS horas_semanais numeric,
  ADD COLUMN IF NOT EXISTS caneta_verde text CHECK (caneta_verde IS NULL OR caneta_verde IN ('sim', 'nao'));

-- 3) Cronograma: trimestre e semana para matriz/GANTT
ALTER TABLE cronograma
  ADD COLUMN IF NOT EXISTS trimestre_id uuid REFERENCES trimestres(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS semana int,
  ADD COLUMN IF NOT EXISTS horas_previstas numeric;
