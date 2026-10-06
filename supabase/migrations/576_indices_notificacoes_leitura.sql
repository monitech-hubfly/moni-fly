-- Leituras quentes de sirene_notificacoes (dedupe de atraso e SLA).
-- Não altera dados nem regras. Idempotente.

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_user_topico_tipo_created
  ON public.sirene_notificacoes (user_id, topico_id, tipo, created_at);

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_user_tipo_card_created
  ON public.sirene_notificacoes (user_id, tipo, referencia_card_id, created_at);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('576', 'indices_notificacoes_leitura')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
