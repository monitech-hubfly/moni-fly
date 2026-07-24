-- 482: Participantes externos (e-mail) na agenda
-- Permite convidar pessoas fora dos profiles do sistema

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS participantes_externos text[] DEFAULT '{}';
