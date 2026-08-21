-- Migração: log de auditoria (executar no SQL Editor do Supabase antes de usar a aba Log)
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario         TEXT NOT NULL,
  is_admin        BOOLEAN DEFAULT FALSE,
  modulo          TEXT NOT NULL,
  area            TEXT,
  entidade        TEXT NOT NULL,
  entidade_id     TEXT,
  operacao        TEXT NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  campo           TEXT,
  valor_anterior  JSONB,
  valor_novo      JSONB,
  descricao       TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at  ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_modulo       ON audit_log (modulo);
CREATE INDEX IF NOT EXISTS idx_audit_log_area         ON audit_log (area);
CREATE INDEX IF NOT EXISTS idx_audit_log_operacao     ON audit_log (operacao);
CREATE INDEX IF NOT EXISTS idx_audit_log_usuario      ON audit_log (usuario);
CREATE INDEX IF NOT EXISTS idx_audit_log_entidade     ON audit_log (entidade);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Idempotente: pode reexecutar após falhas parciais
DROP POLICY IF EXISTS "leitura_audit_log"  ON audit_log;
DROP POLICY IF EXISTS "insercao_audit_log" ON audit_log;

CREATE POLICY "leitura_audit_log"  ON audit_log FOR SELECT USING (true);
CREATE POLICY "insercao_audit_log" ON audit_log FOR INSERT WITH CHECK (true);

-- Conferência no SQL Editor:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'audit_log';
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log'
-- ORDER BY ordinal_position;
