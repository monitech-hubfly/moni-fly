-- Carômetro: sub-metas e metas chave
ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS is_chave boolean DEFAULT false;
ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS publicado boolean DEFAULT false;
ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS objetivo_pai_id uuid
  REFERENCES objetivos(id) ON DELETE SET NULL;
