-- Comentários de eventos da agenda (compartilhados por série recorrente)
CREATE TABLE IF NOT EXISTS gantt_comentarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gantt_id    uuid REFERENCES gantt_planejamento(id) ON DELETE CASCADE,
  grupo_id    uuid,                                     -- recorrencia_grupo_id da série
  profile_id  uuid NOT NULL REFERENCES profiles(id),
  texto       text NOT NULL DEFAULT '',
  mencoes     uuid[] DEFAULT '{}',
  criado_em   timestamptz DEFAULT now(),
  CONSTRAINT chk_gantt_comentario_entidade CHECK (gantt_id IS NOT NULL OR grupo_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_gantt_comentarios_gantt_id  ON gantt_comentarios(gantt_id);
CREATE INDEX IF NOT EXISTS idx_gantt_comentarios_grupo_id  ON gantt_comentarios(grupo_id);
CREATE INDEX IF NOT EXISTS idx_gantt_comentarios_criado_em ON gantt_comentarios(criado_em DESC);

ALTER TABLE gantt_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gc_select" ON gantt_comentarios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "gc_insert" ON gantt_comentarios
  FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());

CREATE POLICY "gc_delete" ON gantt_comentarios
  FOR DELETE TO authenticated USING (profile_id = auth.uid());

-- Anexos de comentários
CREATE TABLE IF NOT EXISTS gantt_comentario_anexos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comentario_id  uuid NOT NULL REFERENCES gantt_comentarios(id) ON DELETE CASCADE,
  storage_path   text NOT NULL,
  nome_original  text NOT NULL,
  mime_type      text,
  tamanho_bytes  bigint,
  criado_em      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gca_comentario_id ON gantt_comentario_anexos(comentario_id);

ALTER TABLE gantt_comentario_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gca_select" ON gantt_comentario_anexos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "gca_insert" ON gantt_comentario_anexos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "gca_delete" ON gantt_comentario_anexos
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM gantt_comentarios gc
      WHERE gc.id = comentario_id AND gc.profile_id = auth.uid()
    )
  );
