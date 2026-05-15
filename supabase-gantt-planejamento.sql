-- Tabela para atividades escolhidas no GANTT por trimestre (nem todas da Workload são realizadas).
-- Rode no Supabase → SQL Editor (uma vez). Se a tabela já existir sem semana_inicio/semana_fim, rode só o segundo bloco.
CREATE TABLE IF NOT EXISTS gantt_planejamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trimestre_id uuid NOT NULL REFERENCES trimestres(id) ON DELETE CASCADE,
  acao_id uuid NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
  responsavel text,
  recorrencia text CHECK (recorrencia IS NULL OR recorrencia IN ('diario', 'semanal', 'mensal')),
  repeticao int CHECK (repeticao IS NULL OR repeticao >= 1),
  semana_inicio int CHECK (semana_inicio IS NULL OR (semana_inicio >= 1 AND semana_inicio <= 13)),
  semana_fim int CHECK (semana_fim IS NULL OR (semana_fim >= 1 AND semana_fim <= 13)),
  criado_em timestamptz DEFAULT now(),
  UNIQUE(trimestre_id, acao_id)
);

-- Se a tabela já foi criada antes sem semana_inicio/semana_fim, descomente e rode:
-- ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS semana_inicio int CHECK (semana_inicio IS NULL OR (semana_inicio >= 1 AND semana_inicio <= 13));
-- ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS semana_fim int CHECK (semana_fim IS NULL OR (semana_fim >= 1 AND semana_fim <= 13));
