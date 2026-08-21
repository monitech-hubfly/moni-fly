-- 476: Melhorias na Agenda
-- • acao_id nullable (permite entradas sem comportamento — ex: origem Kanban)
-- • link_reuniao, recorrencia_grupo_id, titulo
-- • Tabela gantt_agenda_participantes

-- acao_id nullable
ALTER TABLE gantt_planejamento ALTER COLUMN acao_id DROP NOT NULL;

-- Link de reunião (Zoom, Meet, Teams, etc.)
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS link_reuniao text;

-- Agrupa todas as ocorrências de uma recorrência
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS recorrencia_grupo_id uuid;

-- Título livre (usado quando acao_id é null — ex: origem Kanban)
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS titulo text;

-- Origem da entrada: 'sirene' | 'pastelaria' | 'kanban' | 'atividades'
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS origem_tipo text;

-- Participantes da atividade/reunião
CREATE TABLE IF NOT EXISTS gantt_agenda_participantes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gantt_id    uuid NOT NULL REFERENCES gantt_planejamento(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL,
  criado_em   timestamptz DEFAULT now(),
  CONSTRAINT uq_gantt_participante UNIQUE (gantt_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_gantt_part_gantt   ON gantt_agenda_participantes(gantt_id);
CREATE INDEX IF NOT EXISTS idx_gantt_part_profile ON gantt_agenda_participantes(profile_id);

ALTER TABLE gantt_agenda_participantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_part_select" ON gantt_agenda_participantes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "agenda_part_insert" ON gantt_agenda_participantes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "agenda_part_delete" ON gantt_agenda_participantes
  FOR DELETE USING (auth.role() = 'authenticated');
