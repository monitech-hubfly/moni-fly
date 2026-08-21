-- Jurídico: identificações no planejamento Gantt
CREATE TABLE IF NOT EXISTS juridico_identificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('franqueado', 'candidato', 'inc_nuvem', 'interno')),
  oculto boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS juridico_identificacao_id uuid REFERENCES juridico_identificacoes(id),
  ADD COLUMN IF NOT EXISTS juridico_tipo text CHECK (
    juridico_tipo IS NULL OR
    juridico_tipo IN ('franqueado', 'candidato', 'inc_nuvem', 'interno')
  );

ALTER TABLE juridico_identificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "juridico_identificacoes_select" ON juridico_identificacoes;
DROP POLICY IF EXISTS "juridico_identificacoes_insert" ON juridico_identificacoes;
DROP POLICY IF EXISTS "juridico_identificacoes_update" ON juridico_identificacoes;
CREATE POLICY "juridico_identificacoes_select" ON juridico_identificacoes FOR SELECT USING (true);
CREATE POLICY "juridico_identificacoes_insert" ON juridico_identificacoes FOR INSERT WITH CHECK (true);
CREATE POLICY "juridico_identificacoes_update" ON juridico_identificacoes FOR UPDATE USING (true);

NOTIFY pgrst, 'reload schema';
