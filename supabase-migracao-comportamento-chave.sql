-- Preferir o script único (cria periodos + colunas do carometro):
--   supabase-carometro-migracao-completa.sql
--
-- Este arquivo mantém só os ALTERs finais, útil se «periodos» já existir.
ALTER TABLE carometro ADD COLUMN IF NOT EXISTS periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_carometro_periodo ON carometro(periodo_id);
ALTER TABLE carometro ADD COLUMN IF NOT EXISTS comportamento_chave boolean DEFAULT false;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS comportamento_chave boolean DEFAULT false;
