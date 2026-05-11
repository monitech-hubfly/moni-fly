-- Recorrências de atividades (Workload)
-- Rode no Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS recorrencias_atividade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  criado_em timestamptz DEFAULT now()
);

INSERT INTO recorrencias_atividade (codigo, descricao, ativo, ordem)
VALUES
  ('unica', 'Atividade única', true, 1),
  ('diaria', 'Diária', true, 2),
  ('semanal', 'Semanal', true, 3),
  ('mensal', 'Mensal', true, 4),
  ('trimestral', 'Trimestral', true, 5)
ON CONFLICT (codigo) DO NOTHING;

