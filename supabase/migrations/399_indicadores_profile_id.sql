-- Responsável por indicador (1 pessoa por indicador no Plano Boné Day)
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS profile_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;
