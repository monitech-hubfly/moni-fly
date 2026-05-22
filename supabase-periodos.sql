-- Calendário de períodos flexíveis (Semana/Mês/Bimestre/Trimestre/Semestre/Ano)
-- Rode no Supabase → SQL Editor (Run).
--
-- Observação:
-- - Este script é compatível com o modelo legado por trimestre.
-- - Ele adiciona `periodo_id` (NULL permitido) nas tabelas principais para migração gradual.

-- 1) Tabela de períodos
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

CREATE INDEX IF NOT EXISTS idx_periodos_tipo_ano
  ON periodos(tipo, ano);

CREATE INDEX IF NOT EXISTS idx_periodos_datas
  ON periodos(data_inicio, data_fim);

-- 2) Adicionar `periodo_id` nas tabelas que precisam filtrar por período
ALTER TABLE objetivos
  ADD COLUMN IF NOT EXISTS periodo_id uuid REFERENCES periodos(id) ON DELETE SET NULL;

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE;

ALTER TABLE cronograma
  ADD COLUMN IF NOT EXISTS periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE;

ALTER TABLE indicador_lancamentos
  ADD COLUMN IF NOT EXISTS periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE;

ALTER TABLE carometro
  ADD COLUMN IF NOT EXISTS periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE;

-- 3) Semana do ano (ISO) para registros semanais dentro de períodos maiores
-- (Ex.: Gantt/Indicadores no período "Ano" usando semanas 1..52/53)
ALTER TABLE cronograma
  ADD COLUMN IF NOT EXISTS semana_ano int CHECK (semana_ano IS NULL OR (semana_ano >= 1 AND semana_ano <= 53));

ALTER TABLE indicador_lancamentos
  ADD COLUMN IF NOT EXISTS semana_ano int CHECK (semana_ano IS NULL OR (semana_ano >= 1 AND semana_ano <= 53));

ALTER TABLE carometro_semana
  ADD COLUMN IF NOT EXISTS semana_ano int CHECK (semana_ano IS NULL OR (semana_ano >= 1 AND semana_ano <= 53));

-- 3.1) Constraints/uniques para suportar semanas 1..53
-- carometro_semana originalmente limita semana 1..13. Para períodos maiores, aumentamos para 1..53.
ALTER TABLE carometro_semana DROP CONSTRAINT IF EXISTS carometro_semana_semana_check;
ALTER TABLE carometro_semana
  ADD CONSTRAINT carometro_semana_semana_check CHECK (semana >= 1 AND semana <= 53);

-- Unique novo por semana_ano (mantém o legacy em semana)
CREATE UNIQUE INDEX IF NOT EXISTS ux_carometro_semana_carometro_semana_ano
  ON carometro_semana(carometro_id, semana_ano);

-- indicador_lancamentos originalmente tem UNIQUE(indicador_id, trimestre_id, semana).
-- Para o novo modelo: UNIQUE(indicador_id, periodo_id, semana_ano)
CREATE UNIQUE INDEX IF NOT EXISTS ux_indicador_lancamentos_ind_periodo_semana_ano
  ON indicador_lancamentos(indicador_id, periodo_id, semana_ano);

-- cronograma: para evitar duplicatas por semana em um período
CREATE UNIQUE INDEX IF NOT EXISTS ux_cronograma_periodo_acao_semana_ano
  ON cronograma(periodo_id, acao_id, semana_ano);

-- 4) Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_objetivos_periodo ON objetivos(periodo_id);
CREATE INDEX IF NOT EXISTS idx_gantt_planejamento_periodo ON gantt_planejamento(periodo_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_periodo ON cronograma(periodo_id);
CREATE INDEX IF NOT EXISTS idx_indicador_lancamentos_periodo ON indicador_lancamentos(periodo_id);
CREATE INDEX IF NOT EXISTS idx_carometro_periodo ON carometro(periodo_id);

-- 5) Backfill básico (opcional): criar períodos trimestrais a partir de `trimestres`
-- e apontar `periodo_id` quando possível.
-- Se você ainda NÃO quer migrar dados agora, pode comentar tudo abaixo desta linha.

INSERT INTO periodos (tipo, ano, numero, data_inicio, data_fim, ativo)
SELECT
  'trimestre' AS tipo,
  t.ano,
  t.trimestre AS numero,
  t.data_inicio,
  t.data_fim,
  true
FROM trimestres t
WHERE NOT EXISTS (
  SELECT 1 FROM periodos p
  WHERE p.tipo = 'trimestre' AND p.ano = t.ano AND p.numero = t.trimestre
);

-- Objetivos
UPDATE objetivos o
SET periodo_id = p.id
FROM trimestres t
JOIN periodos p
  ON p.tipo = 'trimestre' AND p.ano = t.ano AND p.numero = t.trimestre
WHERE o.periodo_id IS NULL
  AND o.trimestre_id = t.id;

-- Planejamento Gantt
UPDATE gantt_planejamento gp
SET periodo_id = p.id
FROM trimestres t
JOIN periodos p
  ON p.tipo = 'trimestre' AND p.ano = t.ano AND p.numero = t.trimestre
WHERE gp.periodo_id IS NULL
  AND gp.trimestre_id = t.id;

-- Cronograma
UPDATE cronograma c
SET periodo_id = p.id
FROM trimestres t
JOIN periodos p
  ON p.tipo = 'trimestre' AND p.ano = t.ano AND p.numero = t.trimestre
WHERE c.periodo_id IS NULL
  AND c.trimestre_id = t.id;

-- Lançamentos de indicadores
UPDATE indicador_lancamentos l
SET periodo_id = p.id
FROM trimestres t
JOIN periodos p
  ON p.tipo = 'trimestre' AND p.ano = t.ano AND p.numero = t.trimestre
WHERE l.periodo_id IS NULL
  AND l.trimestre_id = t.id;

-- Carômetro
UPDATE carometro c
SET periodo_id = p.id
FROM trimestres t
JOIN periodos p
  ON p.tipo = 'trimestre' AND p.ano = t.ano AND p.numero = t.trimestre
WHERE c.periodo_id IS NULL
  AND c.trimestre_id = t.id;

