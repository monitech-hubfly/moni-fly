-- EXECUTE NO SQL EDITOR DO SUPABASE — CARÔMETRO
-- Gantt: coluna periodo_id em gantt_planejamento + backfill a partir de trimestre_id
--
-- Contexto:
-- - O front filtra por .eq('periodo_id', periodoId). Se a coluna não existir, o PostgREST retorna 400
--   e o app cai no fallback por trimestre_id — registros sem trimestre_id somem do quadro.
-- - O script supabase-periodos.sql já adiciona periodo_id e um UPDATE; use ESTE ficheiro se só
--   precisar de alinhar gantt_planejamento (ou repetir ADD/UPDATE de forma idempotente).

-- Passo 1: coluna + FK (ON DELETE SET NULL evita apagar planejamento ao apagar período)
ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS periodo_id uuid REFERENCES periodos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gantt_planejamento_periodo_id
  ON gantt_planejamento(periodo_id);

-- Passo 2: amostra de registros ainda sem periodo_id (opcional — comentar após validar)
-- SELECT id, acao_id, casa_id, trimestre_id, semanas_selecionadas, periodo_id
-- FROM gantt_planejamento
-- WHERE periodo_id IS NULL
-- LIMIT 50;

-- Passo 3: migrar legado — um trimestre corresponde ao periodos (tipo trimestre, mesmo ano e número)
-- (Requer tabela periodos populada; rode supabase-periodos.sql antes se ainda não existir.)
UPDATE gantt_planejamento gp
SET periodo_id = p.id
FROM trimestres t
JOIN periodos p
  ON p.tipo = 'trimestre'
  AND p.ano = t.ano
  AND p.numero = t.trimestre
WHERE gp.periodo_id IS NULL
  AND gp.trimestre_id IS NOT NULL
  AND gp.trimestre_id = t.id;

-- Passo 3b (opcional): se existir periodo “pai” (ex.: ano) que engloba o trimestre e quiser
-- preencher periodo_id com esse período em vez do trimestre — descomente e ajuste à vossa regra.
-- UPDATE gantt_planejamento gp
-- SET periodo_id = p.id
-- FROM trimestres t
-- JOIN periodos p
--   ON p.data_inicio <= t.data_inicio AND p.data_fim >= t.data_fim
-- WHERE gp.periodo_id IS NULL
--   AND gp.trimestre_id = t.id;

-- Passo 4: verificação agregada
SELECT
  COUNT(*) AS total,
  COUNT(periodo_id) AS com_periodo_id,
  COUNT(*) - COUNT(periodo_id) AS sem_periodo_id
FROM gantt_planejamento;

-- Diagnóstico: cruzar períodos com trimestres (intervalos)
-- SELECT p.id, p.tipo, p.ano, p.numero, p.data_inicio, p.data_fim,
--        t.id AS trimestre_id, t.trimestre, t.data_inicio AS tri_inicio, t.data_fim AS tri_fim
-- FROM periodos p
-- JOIN trimestres t
--   ON t.data_inicio >= p.data_inicio AND t.data_fim <= p.data_fim AND p.tipo = 'trimestre'
-- ORDER BY p.data_inicio, t.data_inicio;
