-- Adiciona responsável direto na meta/sub-meta (carometro todo-planning)
ALTER TABLE objetivos
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
