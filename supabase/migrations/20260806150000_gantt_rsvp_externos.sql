-- RSVP de participantes externos em eventos da Agenda
-- Cada linha = 1 convite por e-mail por evento

CREATE TABLE IF NOT EXISTS gantt_rsvp_externos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gantt_id      uuid NOT NULL REFERENCES gantt_planejamento(id) ON DELETE CASCADE,
  email         text NOT NULL,
  token         uuid NOT NULL DEFAULT gen_random_uuid(),
  status        text NOT NULL DEFAULT 'pendente', -- 'pendente' | 'aceito' | 'recusado'
  respondido_em timestamptz,
  criado_em     timestamptz DEFAULT now(),
  UNIQUE(gantt_id, email)
);

CREATE INDEX IF NOT EXISTS idx_gantt_rsvp_token    ON gantt_rsvp_externos(token);
CREATE INDEX IF NOT EXISTS idx_gantt_rsvp_gantt_id ON gantt_rsvp_externos(gantt_id);

ALTER TABLE gantt_rsvp_externos ENABLE ROW LEVEL SECURITY;

-- Organizador do evento pode ver as respostas
CREATE POLICY "rsvp_select_own" ON gantt_rsvp_externos
  FOR SELECT TO authenticated
  USING (
    gantt_id IN (
      SELECT id FROM gantt_planejamento WHERE profile_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
