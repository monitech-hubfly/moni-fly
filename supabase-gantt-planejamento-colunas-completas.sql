-- =============================================================================
-- Gantt — colunas em gantt_planejamento + tabela casas (FK casa_id)
-- Execute no Supabase → SQL Editor → Run (uma vez). Ordem necessária para FKs.
-- =============================================================================

-- PASSO 1 — Tabela casas (obrigatória antes de casa_id referenciar casas(id))
CREATE TABLE IF NOT EXISTS casas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  area_id uuid REFERENCES areas(id),
  criado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_casas_area_id ON casas(area_id);

ALTER TABLE casas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "casas_select" ON casas;
DROP POLICY IF EXISTS "casas_insert" ON casas;
DROP POLICY IF EXISTS "casas_update" ON casas;
DROP POLICY IF EXISTS "casas_delete" ON casas;

CREATE POLICY "casas_select" ON casas FOR SELECT USING (true);
CREATE POLICY "casas_insert" ON casas FOR INSERT WITH CHECK (true);
CREATE POLICY "casas_update" ON casas FOR UPDATE USING (true);
CREATE POLICY "casas_delete" ON casas FOR DELETE USING (true);

-- PASSO 2 — Colunas em gantt_planejamento (Acoplamento / semanas / Casa)
ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS semanas_selecionadas int[] DEFAULT '{}';

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS franqueado_nome text;

-- Se nomes apareciam só com 1 caractere no app, a coluna pode ter sido criada como CHAR(1).
-- Corrigir para text (únicamente se necessário; não falha se já for text/varchar):
-- ALTER TABLE gantt_planejamento ALTER COLUMN franqueado_nome TYPE text USING franqueado_nome::text;

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS casa_id uuid REFERENCES casas(id);

-- Vários franqueados por mesma atividade/trimestre (legado): remover UNIQUE antigo se existir
ALTER TABLE gantt_planejamento DROP CONSTRAINT IF EXISTS gantt_planejamento_trimestre_id_acao_id_key;

-- PASSO 3 — Conferir colunas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gantt_planejamento'
  AND column_name IN ('semanas_selecionadas', 'casa_id', 'franqueado_nome')
ORDER BY column_name;

-- PASSO 4 — Se o erro "Could not find column / schema cache" continuar após criar as colunas:
-- NOTIFY pgrst, 'reload schema';

-- Conferir texto completo e tipo PostgreSQL de franqueado_nome (Acoplamento):
-- SELECT id, franqueado_nome,
--   pg_typeof(franqueado_nome) AS tipo_postgres,
--   octet_length(franqueado_nome::text) AS tamanho_bytes
-- FROM gantt_planejamento
-- WHERE franqueado_nome IS NOT NULL
-- ORDER BY criado_em DESC
-- LIMIT 5;
--
-- Se tipo_postgres não for text / varchar, forçar:
-- ALTER TABLE gantt_planejamento ALTER COLUMN franqueado_nome TYPE text;

-- Limpeza opcional de registros com franqueado truncado (ex.: só "A"/"B") após corrigir app + tipo da coluna:
-- DELETE FROM gantt_planejamento
-- WHERE franqueado_nome IS NOT NULL AND length(trim(franqueado_nome::text)) = 1;
