-- Armazena o ID do evento criado no GCal pelo HubFly (evita loop de sync)
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS gcal_hubfly_push_id text;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS gcal_hubfly_organizer_email text;
CREATE INDEX IF NOT EXISTS idx_gantt_gcal_push ON gantt_planejamento(gcal_hubfly_push_id) WHERE gcal_hubfly_push_id IS NOT NULL;
