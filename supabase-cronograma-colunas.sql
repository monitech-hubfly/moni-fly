-- Colunas necessárias no cronograma para o GANTT (horas por semana e status).
-- Se ao salvar no GANTT aparecer erro de "horas_previstas", rode este script no Supabase → SQL Editor.
ALTER TABLE cronograma
  ADD COLUMN IF NOT EXISTS trimestre_id uuid REFERENCES trimestres(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS semana int,
  ADD COLUMN IF NOT EXISTS horas_previstas numeric;

-- Casas / Acoplamento: uma linha de cronograma por linha de gantt_planejamento (evita "marcar uma casa marca todas")
ALTER TABLE cronograma
  ADD COLUMN IF NOT EXISTS planejamento_id uuid REFERENCES gantt_planejamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cronograma_planejamento_id ON cronograma(planejamento_id);

-- Se o app ainda mostrar "Could not find ... in the schema cache", rode na mesma sessão:
-- NOTIFY pgrst, 'reload schema';

-- Índices únicos parciais (substitui UNIQUE global em periodo_id+acao_id+semana quando necessário):
-- veja `supabase-fix-cronograma-unique.sql`

NOTIFY pgrst, 'reload schema';
