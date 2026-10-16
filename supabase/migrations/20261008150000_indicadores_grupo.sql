-- Migration: adiciona campo grupo na tabela indicadores
-- Usado para agrupar indicadores standalone (sem vinculo com metas) na tela Bone Day
-- Data: 2026-10-08

ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS grupo TEXT;

-- Recarregar schema do PostgREST
NOTIFY pgrst, 'reload schema';
