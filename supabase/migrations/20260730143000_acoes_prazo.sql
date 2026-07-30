-- 20260730143000: adiciona coluna prazo em acoes
-- necessária para que Atividades Planejadas armazene prazo sem depender de gantt_planejamento
ALTER TABLE acoes ADD COLUMN IF NOT EXISTS prazo date;
