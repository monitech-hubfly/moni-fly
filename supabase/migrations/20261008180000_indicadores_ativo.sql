-- Migration: adiciona coluna ativo em indicadores para soft-delete (arquivar)
-- Arquivar oculta o indicador sem perder histórico de lançamentos
-- Data: 2026-10-08

ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;

-- Todos os existentes ficam ativos
UPDATE indicadores SET ativo = true WHERE ativo IS NULL;

NOTIFY pgrst, 'reload schema';
