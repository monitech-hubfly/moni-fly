-- IMPORTANTE: Este arquivo deve ser executado manualmente no SQL Editor do Supabase.
-- Acesse: https://supabase.com/dashboard → seu projeto → SQL Editor → New query
-- Cole o conteúdo abaixo e clique em "Run".
--
-- Liga cada linha de `cronograma` (horas/status por semana) a uma linha específica de `gantt_planejamento`.
-- Necessário quando a mesma `acao_id` aparece mais de uma vez no período (ex.: Casas LIZ/EVA ou Acoplamento com vários franqueados).

ALTER TABLE cronograma
  ADD COLUMN IF NOT EXISTS planejamento_id uuid REFERENCES gantt_planejamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cronograma_planejamento_id ON cronograma(planejamento_id);

-- Atualiza o cache do PostgREST (evita "Could not find the 'planejamento_id' column ... in the schema cache")
NOTIFY pgrst, 'reload schema';
