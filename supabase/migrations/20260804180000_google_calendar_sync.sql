-- Google Calendar sync
-- Armazena o ID do evento Google para upsert sem duplicar
-- e o email do organizador para exibição no card

ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS google_calendar_event_id text;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS google_calendar_organizer text;

-- Índice único para upsert por (usuário + evento Google)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gantt_google_event
  ON gantt_planejamento(profile_id, google_calendar_event_id)
  WHERE google_calendar_event_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
