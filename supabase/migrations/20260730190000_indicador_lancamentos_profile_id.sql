-- Adiciona profile_id em indicador_lancamentos para fills independentes por usuário
-- Cada usuário que assumiu uma meta preenche seus próprios indicadores

-- 1. Adiciona coluna
ALTER TABLE indicador_lancamentos
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Remove duplicatas (mantém a linha mais recente por indicador_id+semana quando profile_id é null)
DELETE FROM indicador_lancamentos
WHERE ctid NOT IN (
  SELECT DISTINCT ON (indicador_id, semana, profile_id) ctid
  FROM indicador_lancamentos
  ORDER BY indicador_id, semana, profile_id, id DESC
);

-- 3. Remove constraint antiga
ALTER TABLE indicador_lancamentos
  DROP CONSTRAINT IF EXISTS indicador_lancamentos_indicador_id_semana_key;

-- 4. Nova constraint: (indicador_id, semana, profile_id)
-- NULLS NOT DISTINCT: registros sem profile_id são únicos por (indicador_id, semana)
ALTER TABLE indicador_lancamentos
  ADD CONSTRAINT indicador_lancamentos_indicador_semana_profile_key
  UNIQUE NULLS NOT DISTINCT (indicador_id, semana, profile_id);
