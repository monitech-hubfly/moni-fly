-- TO DO & Planning: agendamento, vínculos, recorrência, origem
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS hora_inicio time;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS hora_fim time;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS data_conclusao_real timestamptz;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS sirene_chamado_id bigint
  REFERENCES sirene_chamados(id) ON DELETE SET NULL;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS card_id uuid
  REFERENCES kanban_cards(id) ON DELETE SET NULL;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS atividade_mae_id uuid
  REFERENCES gantt_planejamento(id) ON DELETE SET NULL;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS recorrente boolean DEFAULT false;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS recorrencia_config jsonb;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS tempo_estimado_horas numeric(4,1);
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS origem text DEFAULT 'gantt';
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS pre_bone_day_mes text;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS is_simulacao boolean DEFAULT false;
