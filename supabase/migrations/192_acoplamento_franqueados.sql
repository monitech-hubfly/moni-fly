CREATE TABLE IF NOT EXISTS acoplamento_franqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

GRANT ALL ON TABLE acoplamento_franqueados TO anon;
GRANT ALL ON TABLE acoplamento_franqueados TO authenticated;

ALTER TABLE acoplamento_franqueados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_acoplamento_franqueados" ON acoplamento_franqueados;
CREATE POLICY "allow_all_acoplamento_franqueados"
  ON acoplamento_franqueados FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
