-- Migration: adiciona coluna mes em objetivos
-- Permite que cada meta seja vinculada a um mês específico no Plano Boné Day
-- Formato: 'YYYY-MM' (ex: '2026-07')

ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS mes text;

-- Backfill: metas ativas existentes pertencem a julho/2026 (mês vigente)
UPDATE objetivos SET mes = '2026-07' WHERE status = 'ativo' AND mes IS NULL;

CREATE INDEX IF NOT EXISTS idx_objetivos_mes ON objetivos(mes);

NOTIFY pgrst, 'reload schema';
