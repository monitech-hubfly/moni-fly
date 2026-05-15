-- Coluna para marcar comportamento como chave (comportamento-chave)
-- Execute este script no Supabase (SQL Editor) para habilitar a coluna Chave no Carômetro
ALTER TABLE carometro ADD COLUMN IF NOT EXISTS comportamento_chave boolean DEFAULT false;
