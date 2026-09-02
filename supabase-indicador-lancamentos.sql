-- Lançamentos de indicadores por trimestre e semana (preenchimento das áreas)
-- Rode no Supabase → SQL Editor (após ter a tabela indicadores).

CREATE TABLE IF NOT EXISTS indicador_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES indicadores(id) ON DELETE CASCADE,
  trimestre_id uuid NOT NULL REFERENCES trimestres(id) ON DELETE CASCADE,
  semana int NOT NULL CHECK (semana >= 1 AND semana <= 13),
  valor text,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now(),
  UNIQUE(indicador_id, trimestre_id, semana)
);

CREATE INDEX IF NOT EXISTS idx_indicador_lancamentos_indicador_trimestre ON indicador_lancamentos(indicador_id, trimestre_id);

-- Período flexível (Gantt / Carômetro): opcional; app funciona só com trimestre_id se ausente.
ALTER TABLE indicador_lancamentos
  ADD COLUMN IF NOT EXISTS periodo_id uuid REFERENCES periodos(id) ON DELETE SET NULL;
ALTER TABLE indicador_lancamentos
  ADD COLUMN IF NOT EXISTS semana_ano int;

CREATE INDEX IF NOT EXISTS idx_indicador_lancamentos_periodo ON indicador_lancamentos(periodo_id);
