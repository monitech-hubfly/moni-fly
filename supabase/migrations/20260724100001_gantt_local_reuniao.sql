-- 483: Campo local físico da reunião
ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS local_reuniao text;
