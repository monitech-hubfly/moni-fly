-- Migration: adiciona data_inicio e data_fim em objetivos (Metas Mãe e Filha)
-- data_fim já pode existir (adicionado manualmente); usando IF NOT EXISTS
-- Data: 2026-10-08

ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS data_fim    date;

NOTIFY pgrst, 'reload schema';
