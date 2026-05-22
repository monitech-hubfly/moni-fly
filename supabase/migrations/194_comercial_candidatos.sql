CREATE TABLE IF NOT EXISTS comercial_candidatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

GRANT ALL ON TABLE comercial_candidatos TO anon;
GRANT ALL ON TABLE comercial_candidatos TO authenticated;

ALTER TABLE comercial_candidatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_comercial_candidatos" ON comercial_candidatos;
CREATE POLICY "allow_all_comercial_candidatos"
  ON comercial_candidatos FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS comercial_candidato_id uuid REFERENCES comercial_candidatos(id);

NOTIFY pgrst, 'reload schema';
