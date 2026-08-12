-- Adiciona suporte a convites internos na agenda (Accept/Decline/Propor novo horário)

ALTER TABLE gantt_agenda_participantes
  ADD COLUMN IF NOT EXISTS status         text DEFAULT 'aceito'
    CHECK (status IN ('pendente', 'aceito', 'recusado', 'proposta_horario')),
  ADD COLUMN IF NOT EXISTS proposta_data        text,
  ADD COLUMN IF NOT EXISTS proposta_hora_inicio text,
  ADD COLUMN IF NOT EXISTS proposta_hora_fim    text,
  ADD COLUMN IF NOT EXISTS respondido_em        timestamptz;

-- Registros existentes continuam com status 'aceito' (comportamento anterior)
