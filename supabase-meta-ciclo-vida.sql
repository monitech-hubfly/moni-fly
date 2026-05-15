-- Atalho só com ALTER + NOTIFY: `supabase-objetivos-ciclo-vida-minimo.sql`
--
-- =============================================================================
-- Correção: colunas faltando na tabela `objetivos` (Supabase)
--
-- Problema típico
--   Ao clicar em ✓ para concluir uma meta no Planejamento (Gantt), aparece erro
--   do tipo: falta a coluna objetivos.status (e o bloco de ciclo de vida).
--   As metas dos cards ficam na tabela `objetivos`, não em `metas`.
--
-- Passos
--   1. Abrir o Supabase → SQL Editor
--   2. Colar e executar (Run) o bloco ALTER TABLE `objetivos` abaixo (e o restante
--      se quiser índices / colunas em `indicadores`)
--   3. O NOTIFY ao final recarrega o schema do PostgREST
--   4. Recarregar a página da plataforma (F5) e testar de novo o ✓
--
-- No código do app, a lista de metas dos cards já usa `.eq('status', 'ativo')`
-- em `carregarMetasObjetivos` (Gantt.jsx) após estas colunas existirem.
-- =============================================================================

-- IMPORTANTE: no app Carômetro / Gantt, as «metas» dos cards são a tabela `objetivos`.
-- Se você criou tipo/status/concluido_em apenas em uma tabela `metas`, o PostgREST
-- continuará sem essas colunas em `objetivos` até rodar o bloco ALTER abaixo.
--
-- Em `indicadores`, a coluna `tipo` já existe (quantidade, percentual, …);
-- o tipo recorrente/atingível do indicador fica em `meta_ciclo_tipo`.

ALTER TABLE objetivos
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'recorrente',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS concluido_em TEXT,
  ADD COLUMN IF NOT EXISTS comentario_conclusao TEXT;

-- tipo: 'recorrente' | 'atingivel'
-- status: 'ativo' | 'concluido'

ALTER TABLE indicadores
  ADD COLUMN IF NOT EXISTS meta_ciclo_tipo text DEFAULT 'recorrente',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS concluido_em text,
  ADD COLUMN IF NOT EXISTS comentario_conclusao text,
  ADD COLUMN IF NOT EXISTS meta_unidade text;

CREATE INDEX IF NOT EXISTS idx_objetivos_area_status ON objetivos (area_id, status);
CREATE INDEX IF NOT EXISTS idx_objetivos_status ON objetivos (status);
CREATE INDEX IF NOT EXISTS idx_indicadores_area_status ON indicadores (area_id, status);
CREATE INDEX IF NOT EXISTS idx_indicadores_status ON indicadores (status);

NOTIFY pgrst, 'reload schema';
