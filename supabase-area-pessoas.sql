-- Pessoas vinculadas a cada área (usadas no Gantt / Planejamento como lista de responsáveis).
-- Execute no Supabase → SQL Editor e recarregue a aplicação.

CREATE TABLE IF NOT EXISTS area_pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  CONSTRAINT area_pessoas_area_nome_unique UNIQUE (area_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_area_pessoas_area_id ON area_pessoas(area_id);

COMMENT ON TABLE area_pessoas IS 'Pessoas da equipe por área; nomes incluídos no Planejamento (Gantt) via "+ Novo responsável…" na própria tela.';

-- Acesso via cliente Supabase (anon/authenticated): ajuste políticas no projeto se necessário.
ALTER TABLE area_pessoas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "area_pessoas_select" ON area_pessoas;
DROP POLICY IF EXISTS "area_pessoas_insert" ON area_pessoas;
DROP POLICY IF EXISTS "area_pessoas_update" ON area_pessoas;
DROP POLICY IF EXISTS "area_pessoas_delete" ON area_pessoas;

CREATE POLICY "area_pessoas_select" ON area_pessoas FOR SELECT USING (true);
CREATE POLICY "area_pessoas_insert" ON area_pessoas FOR INSERT WITH CHECK (true);
CREATE POLICY "area_pessoas_update" ON area_pessoas FOR UPDATE USING (true);
CREATE POLICY "area_pessoas_delete" ON area_pessoas FOR DELETE USING (true);
