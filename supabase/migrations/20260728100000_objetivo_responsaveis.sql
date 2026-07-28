-- Migration: tabela objetivo_responsaveis
-- Permite múltiplos usuários se atrelarem como responsáveis de uma meta (objetivo)
-- Usado no Plano Boné Day e TO DO & Planning

CREATE TABLE IF NOT EXISTS objetivo_responsaveis (
  objetivo_id uuid NOT NULL REFERENCES objetivos(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em   timestamptz DEFAULT now(),
  PRIMARY KEY (objetivo_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_objetivo_responsaveis_objetivo ON objetivo_responsaveis(objetivo_id);
CREATE INDEX IF NOT EXISTS idx_objetivo_responsaveis_profile  ON objetivo_responsaveis(profile_id);

ALTER TABLE objetivo_responsaveis ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer autenticado
CREATE POLICY "objetivo_responsaveis_select"
  ON objetivo_responsaveis FOR SELECT TO authenticated
  USING (true);

-- Insert: próprio profile_id OU admin
CREATE POLICY "objetivo_responsaveis_insert"
  ON objetivo_responsaveis FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Delete: próprio profile_id OU admin
CREATE POLICY "objetivo_responsaveis_delete"
  ON objetivo_responsaveis FOR DELETE TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

NOTIFY pgrst, 'reload schema';
