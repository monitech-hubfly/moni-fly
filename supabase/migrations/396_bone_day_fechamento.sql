-- Comentário mensal da área no Fechamento Boné Day
CREATE TABLE IF NOT EXISTS bone_day_fechamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  mes text NOT NULL,
  comentario text,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);
