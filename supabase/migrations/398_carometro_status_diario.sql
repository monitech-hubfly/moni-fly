CREATE TABLE IF NOT EXISTS carometro_status_diario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data date NOT NULL,
  sirene jsonb,
  engajamento jsonb,
  indicadores jsonb,
  criado_em timestamptz DEFAULT now(),
  UNIQUE(area_id, profile_id, data)
);

CREATE INDEX IF NOT EXISTS idx_carometro_status_diario_profile_data
  ON carometro_status_diario(profile_id, data DESC);

NOTIFY pgrst, 'reload schema';
