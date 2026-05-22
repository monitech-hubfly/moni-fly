-- Franqueados por área (listas independentes; Acoplamento permanece em acoplamento_franqueados)

CREATE TABLE IF NOT EXISTS executivos_locais_franqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wayzer_nath_franqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wayzer_rafa_franqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

GRANT ALL ON TABLE executivos_locais_franqueados TO anon;
GRANT ALL ON TABLE executivos_locais_franqueados TO authenticated;
ALTER TABLE executivos_locais_franqueados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_executivos_locais_franqueados" ON executivos_locais_franqueados;
CREATE POLICY "allow_all_executivos_locais_franqueados"
  ON executivos_locais_franqueados FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE wayzer_nath_franqueados TO anon;
GRANT ALL ON TABLE wayzer_nath_franqueados TO authenticated;
ALTER TABLE wayzer_nath_franqueados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_wayzer_nath_franqueados" ON wayzer_nath_franqueados;
CREATE POLICY "allow_all_wayzer_nath_franqueados"
  ON wayzer_nath_franqueados FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE wayzer_rafa_franqueados TO anon;
GRANT ALL ON TABLE wayzer_rafa_franqueados TO authenticated;
ALTER TABLE wayzer_rafa_franqueados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_wayzer_rafa_franqueados" ON wayzer_rafa_franqueados;
CREATE POLICY "allow_all_wayzer_rafa_franqueados"
  ON wayzer_rafa_franqueados FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
