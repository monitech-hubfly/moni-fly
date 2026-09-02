-- =============================================================================
-- Pastelaria — cards, horas semanais, reclassificações e log (Gantt / Carômetro)
-- Execute no Supabase → SQL Editor → Run (uma vez).
-- Pré-requisito: tabela `areas` existente.
-- Depois: NOTIFY pgrst, 'reload schema';
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pastelaria_cards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                text NOT NULL,
  area_id             uuid REFERENCES areas(id) ON DELETE SET NULL,
  estimativa_valor    numeric NOT NULL DEFAULT 1,
  estimativa_unidade  text NOT NULL DEFAULT 'h'
                        CHECK (estimativa_unidade IN ('h','min')),
  coluna              text NOT NULL DEFAULT 'mapped'
                        CHECK (coluna IN ('inbox','mapped','doing','done')),
  semana_origem       text NOT NULL,
  source              text,
  opened_by           text,
  completed_week      text,
  reclassificado              boolean DEFAULT false,
  reclassificado_em           timestamptz,
  reclassificado_destino      text,
  reclassificado_justificativa text,
  responsavel_id      uuid REFERENCES area_pessoas(id) ON DELETE SET NULL,
  responsavel_nome    text,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pastelaria_horas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    uuid NOT NULL REFERENCES pastelaria_cards(id) ON DELETE CASCADE,
  semana     text NOT NULL,
  seg        numeric DEFAULT 0,
  ter        numeric DEFAULT 0,
  qua        numeric DEFAULT 0,
  qui        numeric DEFAULT 0,
  sex        numeric DEFAULT 0,
  unidade    text DEFAULT 'h' CHECK (unidade IN ('h','min')),
  seg_unidade text DEFAULT 'h' CHECK (seg_unidade IN ('h','min')),
  ter_unidade text DEFAULT 'h' CHECK (ter_unidade IN ('h','min')),
  qua_unidade text DEFAULT 'h' CHECK (qua_unidade IN ('h','min')),
  qui_unidade text DEFAULT 'h' CHECK (qui_unidade IN ('h','min')),
  sex_unidade text DEFAULT 'h' CHECK (sex_unidade IN ('h','min')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(card_id, semana)
);

CREATE TABLE IF NOT EXISTS pastelaria_reclassificacoes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id              uuid REFERENCES pastelaria_cards(id) ON DELETE SET NULL,
  action               text NOT NULL CHECK (action IN ('redirect','return')),
  destino              text,
  justificativa        text NOT NULL,
  reclassificado_por   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pastelaria_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    uuid REFERENCES pastelaria_cards(id) ON DELETE SET NULL,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acao       text NOT NULL CHECK (acao IN (
    'criado', 'coluna_alterada', 'aceito', 'reclassificado',
    'horas_registradas', 'editado', 'excluido', 'pessoa_adicionada'
  )),
  detalhes   jsonb,
  created_at timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. Índices
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_area     ON pastelaria_cards(area_id);
CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_coluna   ON pastelaria_cards(coluna);
CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_semana   ON pastelaria_cards(completed_week);
CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_reclass ON pastelaria_cards(reclassificado);
CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_responsavel ON pastelaria_cards(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_pastelaria_horas_card     ON pastelaria_horas(card_id);
CREATE INDEX IF NOT EXISTS idx_pastelaria_horas_semana   ON pastelaria_horas(semana);
CREATE INDEX IF NOT EXISTS idx_pastelaria_log_card       ON pastelaria_log(card_id);
CREATE INDEX IF NOT EXISTS idx_pastelaria_log_created    ON pastelaria_log(created_at);

-- -----------------------------------------------------------------------------
-- 3. Triggers updated_at (mesmo padrão de supabase/migrations/103_atividades_kanban.sql)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_pastelaria_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pastelaria_cards_updated_at ON pastelaria_cards;
CREATE TRIGGER trigger_update_pastelaria_cards_updated_at
  BEFORE UPDATE ON pastelaria_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_pastelaria_cards_updated_at();

CREATE OR REPLACE FUNCTION update_pastelaria_horas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pastelaria_horas_updated_at ON pastelaria_horas;
CREATE TRIGGER trigger_update_pastelaria_horas_updated_at
  BEFORE UPDATE ON pastelaria_horas
  FOR EACH ROW
  EXECUTE FUNCTION update_pastelaria_horas_updated_at();

-- -----------------------------------------------------------------------------
-- 4. RLS (padrão supabase-gantt-planejamento-rls.sql / supabase-comentarios-rls.sql)
-- -----------------------------------------------------------------------------

ALTER TABLE pastelaria_cards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastelaria_horas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastelaria_reclassificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastelaria_log              ENABLE ROW LEVEL SECURITY;

-- pastelaria_cards e pastelaria_horas: autenticados podem tudo (políticas permissivas)
DROP POLICY IF EXISTS "pastelaria_cards_select" ON pastelaria_cards;
DROP POLICY IF EXISTS "pastelaria_cards_insert" ON pastelaria_cards;
DROP POLICY IF EXISTS "pastelaria_cards_update" ON pastelaria_cards;
DROP POLICY IF EXISTS "pastelaria_cards_delete" ON pastelaria_cards;

CREATE POLICY "pastelaria_cards_select" ON pastelaria_cards FOR SELECT USING (true);
CREATE POLICY "pastelaria_cards_insert" ON pastelaria_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "pastelaria_cards_update" ON pastelaria_cards FOR UPDATE USING (true);
CREATE POLICY "pastelaria_cards_delete" ON pastelaria_cards FOR DELETE USING (true);

DROP POLICY IF EXISTS "pastelaria_horas_select" ON pastelaria_horas;
DROP POLICY IF EXISTS "pastelaria_horas_insert" ON pastelaria_horas;
DROP POLICY IF EXISTS "pastelaria_horas_update" ON pastelaria_horas;
DROP POLICY IF EXISTS "pastelaria_horas_delete" ON pastelaria_horas;

CREATE POLICY "pastelaria_horas_select" ON pastelaria_horas FOR SELECT USING (true);
CREATE POLICY "pastelaria_horas_insert" ON pastelaria_horas FOR INSERT WITH CHECK (true);
CREATE POLICY "pastelaria_horas_update" ON pastelaria_horas FOR UPDATE USING (true);
CREATE POLICY "pastelaria_horas_delete" ON pastelaria_horas FOR DELETE USING (true);

-- pastelaria_reclassificacoes e pastelaria_log: INSERT autenticado, SELECT só service_role
DROP POLICY IF EXISTS "pastelaria_reclassificacoes_insert" ON pastelaria_reclassificacoes;
DROP POLICY IF EXISTS "pastelaria_reclassificacoes_select" ON pastelaria_reclassificacoes;

CREATE POLICY "pastelaria_reclassificacoes_insert" ON pastelaria_reclassificacoes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "pastelaria_reclassificacoes_select" ON pastelaria_reclassificacoes
  FOR SELECT USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "pastelaria_log_insert" ON pastelaria_log;
DROP POLICY IF EXISTS "pastelaria_log_select" ON pastelaria_log;

CREATE POLICY "pastelaria_log_insert" ON pastelaria_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "pastelaria_log_select" ON pastelaria_log
  FOR SELECT USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 4.1 GRANTs (obrigatório com RLS — sem isso: "permission denied for table")
-- Padrão: supabase/migrations/187_indicador_conquistas_snapshot.sql
-- -----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pastelaria_cards TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pastelaria_horas TO anon, authenticated;
GRANT INSERT ON TABLE public.pastelaria_reclassificacoes TO authenticated;
GRANT INSERT ON TABLE public.pastelaria_log TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. View pastelaria_gantt_semanas (bloco de visualização no Gantt)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.pastelaria_gantt_semanas AS
WITH cards_ativos AS (
  SELECT
    c.id,
    c.nome,
    c.coluna,
    c.completed_week,
    c.semana_origem,
    c.responsavel_id,
    c.responsavel_nome,
    a.nome AS area_nome,
    ap.nome AS responsavel_pessoa_nome
  FROM pastelaria_cards c
  LEFT JOIN areas a ON a.id = c.area_id
  LEFT JOIN area_pessoas ap ON ap.id = c.responsavel_id
  WHERE c.coluna IN ('done', 'doing')
    AND COALESCE(c.reclassificado, false) = false
),
base AS (
  SELECT
    COALESCE(h.semana, ca.semana_origem) AS semana,
    ca.id,
    ca.nome,
    ca.area_nome,
    ca.coluna,
    ca.completed_week,
    COALESCE(ca.responsavel_pessoa_nome, ca.responsavel_nome) AS responsavel_nome,
    jsonb_build_object(
      'seg', COALESCE(h.seg, 0),
      'ter', COALESCE(h.ter, 0),
      'qua', COALESCE(h.qua, 0),
      'qui', COALESCE(h.qui, 0),
      'sex', COALESCE(h.sex, 0)
    ) AS horas_por_semana,
    (
      COALESCE(h.seg, 0) + COALESCE(h.ter, 0) + COALESCE(h.qua, 0)
      + COALESCE(h.qui, 0) + COALESCE(h.sex, 0)
    ) AS total_horas_semana
  FROM cards_ativos ca
  LEFT JOIN pastelaria_horas h ON h.card_id = ca.id
)
SELECT
  semana,
  COUNT(*)::bigint AS total_cards,
  SUM(total_horas_semana) AS total_horas,
  jsonb_agg(
    jsonb_build_object(
      'id', id,
      'nome', nome,
      'area_nome', area_nome,
      'coluna', coluna,
      'completed_week', completed_week,
      'responsavel_nome', responsavel_nome,
      'horas_por_semana', horas_por_semana,
      'total_horas_semana', total_horas_semana
    )
    ORDER BY nome
  ) AS cards
FROM base
GROUP BY semana
ORDER BY semana;

GRANT SELECT ON public.pastelaria_gantt_semanas TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Conferência no SQL Editor (opcional):
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name LIKE 'pastelaria%'
--   ORDER BY table_name;
-- SELECT table_name FROM information_schema.views
--   WHERE table_schema = 'public' AND table_name = 'pastelaria_gantt_semanas';
-- SELECT policyname, cmd FROM pg_policies
--   WHERE tablename LIKE 'pastelaria%' ORDER BY tablename, policyname;
-- -----------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
