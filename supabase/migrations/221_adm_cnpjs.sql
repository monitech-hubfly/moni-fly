-- ADM — empresas (CNPJ) no Planejamento Gantt
CREATE TABLE IF NOT EXISTS adm_cnpjs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  descritivo text NOT NULL,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS adm_cnpj_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gantt_planejamento_adm_cnpj_id_fkey'
  ) THEN
    ALTER TABLE gantt_planejamento
      ADD CONSTRAINT gantt_planejamento_adm_cnpj_id_fkey
      FOREIGN KEY (adm_cnpj_id) REFERENCES adm_cnpjs(id) ON DELETE SET NULL;
  END IF;
END $$;

GRANT ALL ON TABLE adm_cnpjs TO anon;
GRANT ALL ON TABLE adm_cnpjs TO authenticated;

ALTER TABLE adm_cnpjs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_adm_cnpjs" ON adm_cnpjs;
CREATE POLICY "allow_all_adm_cnpjs"
  ON adm_cnpjs FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
