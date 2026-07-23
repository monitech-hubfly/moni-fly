-- 479: Colunas de vínculo da Agenda em gantt_planejamento
-- franqueado_id, rede_loteador_id, condominio_id e comentario_conclusao
-- estavam no payload do insert mas ausentes na tabela (causa do PGRST204)

ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS franqueado_id    uuid REFERENCES rede_franqueados(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rede_loteador_id uuid REFERENCES rede_loteadores(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condominio_id    uuid REFERENCES condominios(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comentario_conclusao text;

NOTIFY pgrst, 'reload schema';
