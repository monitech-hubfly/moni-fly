
CREATE TABLE IF NOT EXISTS area_pessoas_users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_pessoa_id uuid NOT NULL,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (area_pessoa_id),
  UNIQUE (user_id)
);
ALTER TABLE area_pessoas_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_area_pessoas_users" ON area_pessoas_users;
CREATE POLICY "allow_all_area_pessoas_users"
  ON area_pessoas_users FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON area_pessoas_users TO anon, authenticated;

CREATE TABLE IF NOT EXISTS sirene_pastelaria_vinculos (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  sirene_chamado_id bigint  NOT NULL,
  pastelaria_card_id uuid   NOT NULL,
  created_at        timestamptz DEFAULT now()
);
ALTER TABLE sirene_pastelaria_vinculos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_sirene_pastelaria_vinculos" ON sirene_pastelaria_vinculos;
CREATE POLICY "allow_all_sirene_pastelaria_vinculos"
  ON sirene_pastelaria_vinculos FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON sirene_pastelaria_vinculos TO anon, authenticated;

CREATE TABLE IF NOT EXISTS batalha_casas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id          uuid NOT NULL,
  casa_escolhida_id    uuid NOT NULL,
  listing_id           uuid NOT NULL,
  nota_preco           numeric,
  nota_produto         numeric,
  nota_localizacao     numeric,
  nota_final           numeric,
  atributos_lote_json  jsonb,
  preco_dados_json     jsonb,
  produto_dados_json   jsonb,
  created_at           timestamptz DEFAULT now()
);
ALTER TABLE batalha_casas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_batalha_casas" ON batalha_casas;
CREATE POLICY "allow_all_batalha_casas"
  ON batalha_casas FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON batalha_casas TO anon, authenticated;

CREATE TABLE IF NOT EXISTS kanban_card_cronologia (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    uuid NOT NULL,
  usuario_id uuid,
  tipo       text NOT NULL,
  descricao  text,
  meta       jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE kanban_card_cronologia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_kanban_card_cronologia" ON kanban_card_cronologia;
CREATE POLICY "allow_all_kanban_card_cronologia"
  ON kanban_card_cronologia FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON kanban_card_cronologia TO anon, authenticated;

CREATE TABLE IF NOT EXISTS kanban_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kanban_id  uuid NOT NULL,
  nome       text NOT NULL,
  cor        text NOT NULL DEFAULT '#F5A623',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE kanban_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_kanban_tags" ON kanban_tags;
CREATE POLICY "allow_all_kanban_tags"
  ON kanban_tags FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON kanban_tags TO anon, authenticated;

CREATE TABLE IF NOT EXISTS kanban_card_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    uuid NOT NULL,
  tag_id     uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE kanban_card_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_kanban_card_tags" ON kanban_card_tags;
CREATE POLICY "allow_all_kanban_card_tags"
  ON kanban_card_tags FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON kanban_card_tags TO anon, authenticated;

ALTER TABLE sirene_chamados
  ADD COLUMN IF NOT EXISTS arquivado boolean DEFAULT false;

ALTER TABLE sirene_topicos
  ADD COLUMN IF NOT EXISTS tema text;

ALTER TABLE kanban_cards
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

NOTIFY pgrst, 'reload schema';
