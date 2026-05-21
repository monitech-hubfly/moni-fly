CREATE TABLE IF NOT EXISTS portfolio_franqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

GRANT ALL ON TABLE portfolio_franqueados TO anon;
GRANT ALL ON TABLE portfolio_franqueados TO authenticated;

ALTER TABLE portfolio_franqueados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_portfolio_franqueados" ON portfolio_franqueados;
CREATE POLICY "allow_all_portfolio_franqueados"
  ON portfolio_franqueados FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS portfolio_franqueado_id uuid REFERENCES portfolio_franqueados(id);

NOTIFY pgrst, 'reload schema';
