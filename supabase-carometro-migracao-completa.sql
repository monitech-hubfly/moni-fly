-- =============================================================================
-- Migração COMPLETA para o Carômetro: periodos + carometro.periodo_id + chave
-- Rode no Supabase → SQL Editor → Run (uma vez por projeto).
--
-- Resolve: column carometro.periodo_id (42703); tabela carometro_semana ausente; cache PostgREST
-- Ordem: cria «periodos» antes da FK em «carometro».
-- =============================================================================

-- 1) Tabela periodos (obrigatória para a FK; IF NOT EXISTS não altera tabela já existente)
CREATE TABLE IF NOT EXISTS periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('ano','semestre','bimestre','trimestre','mes','semana')),
  ano int NOT NULL,
  numero int NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  CONSTRAINT periodos_data_valida CHECK (data_fim >= data_inicio),
  CONSTRAINT periodos_numero_valido CHECK (
    (tipo = 'ano' AND numero IS NULL) OR
    (tipo = 'semestre' AND numero BETWEEN 1 AND 2) OR
    (tipo = 'bimestre' AND numero BETWEEN 1 AND 6) OR
    (tipo = 'trimestre' AND numero BETWEEN 1 AND 4) OR
    (tipo = 'mes' AND numero BETWEEN 1 AND 12) OR
    (tipo = 'semana' AND numero BETWEEN 1 AND 53)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_periodos_tipo_ano_numero
  ON periodos(tipo, ano, COALESCE(numero, 0));
CREATE INDEX IF NOT EXISTS idx_periodos_tipo_ano ON periodos(tipo, ano);
CREATE INDEX IF NOT EXISTS idx_periodos_datas ON periodos(data_inicio, data_fim);

-- 2) Carômetro / Gantt (usado pelo scorecard e toggle de chave)
ALTER TABLE carometro ADD COLUMN IF NOT EXISTS periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_carometro_periodo ON carometro(periodo_id);

ALTER TABLE carometro ADD COLUMN IF NOT EXISTS comportamento_chave boolean DEFAULT false;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS comportamento_chave boolean DEFAULT false;

-- Indicadores: marca «chave» no scorecard (nome preferido no app: indicador_chave)
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS indicador_chave boolean DEFAULT false;

-- Status por semana no scorecard (pontos por comportamento); exige tabela «carometro» já existente
CREATE TABLE IF NOT EXISTS carometro_semana (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carometro_id uuid NOT NULL REFERENCES carometro(id) ON DELETE CASCADE,
  semana int NOT NULL CHECK (semana >= 1 AND semana <= 13),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido')),
  criado_em timestamptz DEFAULT now(),
  UNIQUE(carometro_id, semana)
);
ALTER TABLE carometro_semana ADD COLUMN IF NOT EXISTS semana_ano int CHECK (semana_ano IS NULL OR (semana_ano >= 1 AND semana_ano <= 53));
ALTER TABLE carometro_semana DROP CONSTRAINT IF EXISTS carometro_semana_semana_check;
ALTER TABLE carometro_semana
  ADD CONSTRAINT carometro_semana_semana_check CHECK (semana >= 1 AND semana <= 53);
CREATE UNIQUE INDEX IF NOT EXISTS ux_carometro_semana_carometro_semana_ano
  ON carometro_semana(carometro_id, semana_ano);

-- 3) Atualizar cache da API (se der «permission denied», use o botão no painel)
NOTIFY pgrst, 'reload schema';
