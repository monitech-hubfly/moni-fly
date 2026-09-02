-- Blockers por área/mês, vinculável a uma meta
CREATE TABLE IF NOT EXISTS bone_day_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  mes text NOT NULL,
  objetivo_id uuid REFERENCES objetivos(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  profile_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz DEFAULT now()
);
