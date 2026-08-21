-- Snapshot de indicadores atingíveis (substitui schema legado periodo_id + conquista da 090).
-- Idempotente: adiciona colunas usadas pelo Gantt/Conquistas sem dropar dados antigos.

ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas(id) ON DELETE CASCADE;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS unidade text;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS prazo_original text;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS data_conclusao timestamptz DEFAULT now();
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS semana_conclusao int;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS ano_iso_conclusao int;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS ultimo_valor text;
ALTER TABLE indicador_conquistas ADD COLUMN IF NOT EXISTS no_prazo boolean DEFAULT true;

UPDATE indicador_conquistas ic
SET nome = COALESCE(ic.nome, ic.conquista, 'Indicador')
WHERE ic.nome IS NULL;

UPDATE indicador_conquistas ic
SET area_id = i.area_id
FROM indicadores i
WHERE ic.indicador_id = i.id AND ic.area_id IS NULL AND i.area_id IS NOT NULL;

UPDATE indicador_conquistas
SET data_conclusao = COALESCE(data_conclusao, criado_em, now())
WHERE data_conclusao IS NULL;

UPDATE indicador_conquistas
SET semana_conclusao = COALESCE(semana_conclusao, 1)
WHERE semana_conclusao IS NULL;

UPDATE indicador_conquistas
SET no_prazo = COALESCE(no_prazo, true)
WHERE no_prazo IS NULL;

ALTER TABLE indicador_conquistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "indicador_conquistas_select" ON indicador_conquistas;
DROP POLICY IF EXISTS "indicador_conquistas_insert" ON indicador_conquistas;
DROP POLICY IF EXISTS "Allow all for authenticated" ON indicador_conquistas;

CREATE POLICY "indicador_conquistas_select" ON indicador_conquistas FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "indicador_conquistas_insert" ON indicador_conquistas FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "indicador_conquistas_update" ON indicador_conquistas FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "indicador_conquistas_delete" ON indicador_conquistas FOR DELETE TO authenticated, anon USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE indicador_conquistas TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
