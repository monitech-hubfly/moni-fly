-- Execute no Supabase (SQL Editor) para adicionar campos do Workload tipo Sheets
-- e acompanhamento semanal (Gantt por semana). Rode na ordem.

-- 1. Tarefas: vincular à META (objetivo), responsável, periodicidade, horas semanais
alter table tarefas
  add column if not exists objetivo_id uuid references objetivos(id) on delete set null,
  add column if not exists responsavel text,
  add column if not exists periodicidade text default 'Única',
  add column if not exists horas_semanais numeric;

-- 2. Ações: responsável, periodicidade, horas semanais
alter table acoes
  add column if not exists responsavel text,
  add column if not exists periodicidade text default 'Única',
  add column if not exists horas_semanais numeric;

-- 3. Cronograma: semana do trimestre (1-13 para Q1, etc.) e horas previstas na semana
alter table cronograma
  add column if not exists trimestre_id uuid references trimestres(id) on delete cascade,
  add column if not exists semana int,
  add column if not exists horas_previstas numeric;
