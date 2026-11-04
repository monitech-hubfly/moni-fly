-- Migration: adicionar coluna indicadores_previa em carometro_status_diario
-- Já existe em PROD; esta migration sincroniza o banco DEV.
ALTER TABLE carometro_status_diario
  ADD COLUMN IF NOT EXISTS indicadores_previa jsonb;

NOTIFY pgrst, 'reload schema';
