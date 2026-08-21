-- =====================================================
-- EXECUTE NO SQL EDITOR DO SUPABASE — CARÔMETRO
-- Corrige o índice único de cronograma para permitir
-- múltiplas casas/franqueados na mesma semana+ação
-- =====================================================

-- Passo 1: Ver todos os índices atuais de cronograma
-- (rode isso primeiro para confirmar os nomes antes de dropar)
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'cronograma'
ORDER BY indexname;

-- Passo 2: Garantir coluna planejamento_id
ALTER TABLE cronograma
  ADD COLUMN IF NOT EXISTS planejamento_id uuid
  REFERENCES gantt_planejamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cronograma_planejamento_id
  ON cronograma(planejamento_id);

-- Passo 3: Dropar índices únicos antigos / nomes comuns de migração
-- (ajuste conforme resultado do Passo 1, se algum nome for diferente)
DROP INDEX IF EXISTS ux_cronograma_periodo_acao_semana_ano;
DROP INDEX IF EXISTS ux_cronograma_periodo_acao_semana;
DROP INDEX IF EXISTS cronograma_periodo_id_acao_id_semana_ano_key;
DROP INDEX IF EXISTS cronograma_acao_id_semana_ano_key;
-- Nome da versão anterior deste script (evita dois índices parciais “sem plano”)
DROP INDEX IF EXISTS ux_cronograma_periodo_acao_semana_sem_plano;

-- Se o único existir como CONSTRAINT (nome costuma terminar em _key), use também:
ALTER TABLE cronograma DROP CONSTRAINT IF EXISTS cronograma_periodo_id_acao_id_semana_ano_key;
ALTER TABLE cronograma DROP CONSTRAINT IF EXISTS cronograma_acao_id_semana_ano_key;

-- Passo 4: Criar dois índices parciais que substituem o antigo
-- Linhas COM planejamento_id: único por plano+semana (uma linha por casa/franqueado)
CREATE UNIQUE INDEX IF NOT EXISTS ux_cronograma_planejamento_semana
  ON cronograma(planejamento_id, semana_ano)
  WHERE planejamento_id IS NOT NULL;

-- Linhas SEM planejamento_id: mantém unicidade antiga (retrocompatível)
CREATE UNIQUE INDEX IF NOT EXISTS ux_cronograma_sem_plano_periodo_acao_semana
  ON cronograma(periodo_id, acao_id, semana_ano)
  WHERE planejamento_id IS NULL;

-- Passo 5: Verificar resultado final
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'cronograma'
ORDER BY indexname;

-- Atualiza o cache do PostgREST após mudanças em cronograma
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Opcional: linhas de cronograma sem planejamento_id quando há várias casas
-- no gantt_planejamento (após migrar índices, pode precisar marcar de novo na UI)
-- ---------------------------------------------------------------------------
-- SELECT c.acao_id, c.semana_ano, count(*) AS total_cronograma,
--        (SELECT count(*) FROM gantt_planejamento gp
--         WHERE gp.acao_id = c.acao_id AND gp.casa_id IS NOT NULL) AS total_casas
-- FROM cronograma c
-- WHERE c.planejamento_id IS NULL
-- GROUP BY c.acao_id, c.semana_ano
-- HAVING (SELECT count(*) FROM gantt_planejamento gp
--         WHERE gp.acao_id = c.acao_id AND gp.casa_id IS NOT NULL) > 1;
