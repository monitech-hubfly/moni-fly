CREATE TABLE IF NOT EXISTS controladoria_cnpjs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  descritivo text NOT NULL,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS controladoria_cnpj_id uuid REFERENCES controladoria_cnpjs(id);

GRANT ALL ON TABLE controladoria_cnpjs TO anon;
GRANT ALL ON TABLE controladoria_cnpjs TO authenticated;

ALTER TABLE controladoria_cnpjs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_controladoria_cnpjs" ON controladoria_cnpjs;
CREATE POLICY "allow_all_controladoria_cnpjs"
  ON controladoria_cnpjs FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
