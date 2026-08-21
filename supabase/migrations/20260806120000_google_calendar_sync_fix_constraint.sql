-- Substitui índice parcial por UNIQUE CONSTRAINT completo
-- O índice parcial (WHERE google_calendar_event_id IS NOT NULL) não funciona
-- com o upsert do PostgREST (onConflict não passa a cláusula WHERE).
-- UNIQUE CONSTRAINT completo funciona porque NULL != NULL no PostgreSQL,
-- então múltiplas linhas com google_calendar_event_id = NULL são permitidas.

DROP INDEX IF EXISTS idx_gantt_google_event;

ALTER TABLE gantt_planejamento
  ADD CONSTRAINT uq_gantt_google_event
  UNIQUE (profile_id, google_calendar_event_id);

NOTIFY pgrst, 'reload schema';
