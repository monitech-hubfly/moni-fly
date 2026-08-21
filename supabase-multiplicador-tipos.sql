-- Tipos de multiplicador para atividades (Workload)
-- Permite ao admin editar a lista no Cadastro. Rode no Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS multiplicador_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  criado_em timestamptz DEFAULT now()
);

INSERT INTO multiplicador_tipos (codigo, descricao, ativo, ordem)
VALUES
  ('franks', 'Franks', true, 1),
  ('cpnjs', 'CPNJs', true, 2),
  ('leads', 'Leads', true, 3)
ON CONFLICT (codigo) DO NOTHING;

-- Permite que acoes.multiplicador_tipo use qualquer valor cadastrado em multiplicador_tipos.
-- Se a coluna tiver CHECK fixo, execute no SQL Editor (pode dar erro se o constraint tiver outro nome):
-- ALTER TABLE acoes DROP CONSTRAINT IF EXISTS acoes_multiplicador_tipo_check;
