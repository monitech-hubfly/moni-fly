-- Campos de confirmação no funil Operações (Pré Obra e Obra)
-- Idempotente: ADD COLUMN IF NOT EXISTS

ALTER TABLE kanban_cards
  ADD COLUMN IF NOT EXISTS prefeitura_aprovada boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS prefeitura_aprovada_em timestamptz DEFAULT null,
  ADD COLUMN IF NOT EXISTS obra_iniciada boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS obra_iniciada_em timestamptz DEFAULT null,
  ADD COLUMN IF NOT EXISTS obra_finalizada boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS obra_finalizada_em timestamptz DEFAULT null;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('393', 'campos_confirmacao_operacoes')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
