-- Tabela de blockers de metas
CREATE TABLE IF NOT EXISTS blockers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id    uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  objetivo_id uuid REFERENCES objetivos(id) ON DELETE SET NULL,
  descricao  text NOT NULL,
  criado_por uuid REFERENCES profiles(id) ON DELETE SET NULL,
  criado_em  timestamptz DEFAULT now(),
  resolvido  boolean NOT NULL DEFAULT false,
  resolvido_em timestamptz
);

CREATE INDEX IF NOT EXISTS idx_blockers_area_id ON blockers(area_id);
CREATE INDEX IF NOT EXISTS idx_blockers_objetivo_id ON blockers(objetivo_id);

ALTER TABLE blockers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blockers_select" ON blockers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM area_pessoas ap
      WHERE ap.area_id = blockers.area_id
        AND ap.profile_id = auth.uid()
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "blockers_insert" ON blockers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "blockers_update" ON blockers
  FOR UPDATE USING (
    auth.uid() = criado_por
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "blockers_delete" ON blockers
  FOR DELETE USING (
    auth.uid() = criado_por
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
