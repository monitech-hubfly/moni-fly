-- Indicadores (novo: por área; legado: por comportamento/tarefa)
-- Permite definir tipos: quantidade, binário (fez/não fez), percentual, valor financeiro, nota, outro.
-- Rode no Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS indicadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Novo modelo (recomendado): indicador pertence à área
  area_id uuid REFERENCES areas(id) ON DELETE CASCADE,
  -- Modelo legado: indicador atrelado a um comportamento (tarefa)
  tarefa_id uuid REFERENCES tarefas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'quantidade' CHECK (tipo IN (
    'quantidade',
    'binario',
    'percentual',
    'valor_financeiro',
    'nota',
    'outro'
  )),
  unidade text,
  meta_valor numeric,
  ordem int DEFAULT 0,
  criado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_indicadores_tarefa_id ON indicadores(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_indicadores_area_id ON indicadores(area_id);

-- Migração para bases já existentes:
-- ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas(id) ON DELETE CASCADE;
-- ALTER TABLE indicadores ALTER COLUMN tarefa_id DROP NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_indicadores_area_id ON indicadores(area_id);
-- Carômetro (scorecard): ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS indicador_chave boolean DEFAULT false;
-- (ou use supabase-carometro-migracao-completa.sql)
