-- 443: cria multiplicador_tipos caso nao exista (idempotente)
-- Cobre dois cenarios:
--   PROD: tabela nao existe → CREATE TABLE cria com schema atual
--   DEV:  tabela existe com schema legado (090+196) → ALTER corrige constraints

CREATE TABLE IF NOT EXISTS multiplicador_tipos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text        NOT NULL UNIQUE,
  descricao   text        NOT NULL,
  ativo       boolean     NOT NULL DEFAULT true,
  ordem       int         NOT NULL DEFAULT 0,
  criado_em   timestamptz DEFAULT now()
);

-- Adiciona colunas que podem faltar em ambientes com versao antiga (090 sem 196)
ALTER TABLE multiplicador_tipos ADD COLUMN IF NOT EXISTS codigo    text;
ALTER TABLE multiplicador_tipos ADD COLUMN IF NOT EXISTS ativo     boolean NOT NULL DEFAULT true;
ALTER TABLE multiplicador_tipos ADD COLUMN IF NOT EXISTS ordem     int     NOT NULL DEFAULT 0;

-- Torna nome nullable se existir com NOT NULL (coluna legada, nao mais usada pelo app)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'multiplicador_tipos'
      AND column_name = 'nome'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE multiplicador_tipos ALTER COLUMN nome DROP NOT NULL;
  END IF;
END $$;

-- Adiciona constraint UNIQUE em codigo se ainda nao existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'multiplicador_tipos_codigo_key'
      AND conrelid = 'multiplicador_tipos'::regclass
  ) THEN
    ALTER TABLE multiplicador_tipos ADD CONSTRAINT multiplicador_tipos_codigo_key UNIQUE (codigo);
  END IF;
END $$;

-- Preenche codigo a partir de nome para linhas legadas sem codigo
UPDATE multiplicador_tipos SET codigo = LOWER(REPLACE(nome, ' ', '_')) WHERE codigo IS NULL;

-- Dados iniciais conforme DEV (idempotente via ON CONFLICT)
INSERT INTO multiplicador_tipos (codigo, descricao, ativo, ordem)
VALUES
  ('franks',   'Franks',   true, 1),
  ('cpnjs',    'CPNJs',    true, 2),
  ('leads',    'Leads',    true, 3),
  ('perfil',   'Perfil',   true, 4),
  ('terreno',  'Terreno',  true, 5),
  ('obras',    'Obras',    true, 6),
  ('ofertas',  'Ofertas',  true, 7)
ON CONFLICT (codigo) DO NOTHING;
