-- Mínimo: colunas de ciclo de vida em objetivos (erro "falta objetivos.status").
-- Supabase → SQL Editor → Run. Depois F5 na aplicação.
-- (Versão completa com índices e indicadores: supabase-meta-ciclo-vida.sql)

ALTER TABLE objetivos
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'recorrente',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS concluido_em TEXT,
  ADD COLUMN IF NOT EXISTS comentario_conclusao TEXT;

NOTIFY pgrst, 'reload schema';
