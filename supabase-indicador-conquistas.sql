-- Conquistas de indicadores atingíveis (snapshot ao clicar em Concluir).
-- Execute no Supabase → SQL Editor → Run. Depois: NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS indicador_conquistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES indicadores(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  unidade text,
  prazo_original text,
  data_conclusao timestamptz NOT NULL DEFAULT now(),
  semana_conclusao int NOT NULL,
  ano_iso_conclusao int,
  ultimo_valor text,
  no_prazo boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_indicador_conquistas_area_data ON indicador_conquistas (area_id, data_conclusao DESC);
CREATE INDEX IF NOT EXISTS idx_indicador_conquistas_indicador ON indicador_conquistas (indicador_id);

ALTER TABLE indicador_conquistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "indicador_conquistas_select" ON indicador_conquistas;
DROP POLICY IF EXISTS "indicador_conquistas_insert" ON indicador_conquistas;

CREATE POLICY "indicador_conquistas_select" ON indicador_conquistas FOR SELECT USING (true);
CREATE POLICY "indicador_conquistas_insert" ON indicador_conquistas FOR INSERT WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
