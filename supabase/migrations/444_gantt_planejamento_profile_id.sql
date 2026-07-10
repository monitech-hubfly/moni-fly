-- 444: adiciona profile_id a gantt_planejamento (faltante em PROD)
-- Coluna que vincula o registro ao usuario logado — usada pelo backlog/carometro
-- para filtrar atividades planejadas por usuario sem depender do campo texto 'responsavel'

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gantt_planejamento_profile_id
  ON gantt_planejamento (profile_id)
  WHERE profile_id IS NOT NULL;
