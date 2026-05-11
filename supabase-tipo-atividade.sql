-- Tipo da atividade + par esteira (Modelagem / Documentação) em acoes
-- Áreas: Projetos - Modelo Virtual, Projetos - Executivos Locais
-- Execute no Supabase → SQL Editor.

ALTER TABLE acoes
  ADD COLUMN IF NOT EXISTS tipo_atividade varchar(20) DEFAULT NULL
  CHECK (tipo_atividade IN ('modelagem', 'documentacao', NULL));

ALTER TABLE acoes
  ADD COLUMN IF NOT EXISTS esteira_par_id uuid DEFAULT NULL
  REFERENCES acoes(id) ON DELETE SET NULL;
