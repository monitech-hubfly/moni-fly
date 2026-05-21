-- Status de Preenchimento — registros semanais por área e usuário
CREATE TABLE IF NOT EXISTS status_preenchimento_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id),
  usuario_id uuid NOT NULL REFERENCES auth.users(id),
  semana_iso int NOT NULL,
  ano int NOT NULL,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('ok', 'nok')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_preenchimento_area_semana
  ON status_preenchimento_registros (area_id, semana_iso, ano);

CREATE INDEX IF NOT EXISTS idx_status_preenchimento_usuario
  ON status_preenchimento_registros (usuario_id, semana_iso, ano);

ALTER TABLE status_preenchimento_registros ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON status_preenchimento_registros TO authenticated;
GRANT SELECT ON status_preenchimento_registros TO anon;

DROP POLICY IF EXISTS "select_all" ON status_preenchimento_registros;
DROP POLICY IF EXISTS "insert_authenticated" ON status_preenchimento_registros;

CREATE POLICY "select_all" ON status_preenchimento_registros
  FOR SELECT USING (true);

CREATE POLICY "insert_authenticated" ON status_preenchimento_registros
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
