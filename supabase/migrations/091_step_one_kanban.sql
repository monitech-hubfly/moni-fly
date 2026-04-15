-- Kanban genérico + Funil Step One
-- Cria kanbans, kanban_fases e kanban_cards com RLS por franqueado/role.

-- ─── kanbans ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kanbans (
  id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nome    TEXT    NOT NULL,
  ordem   INT     NOT NULL DEFAULT 0,
  cor_hex TEXT,
  ativo   BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE public.kanbans IS 'Boards de kanban do Hub Fly (ex: Funil Step One).';

-- ─── kanban_fases ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kanban_fases (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  kanban_id  UUID    NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  nome       TEXT    NOT NULL,
  ordem      INT     NOT NULL DEFAULT 0,
  sla_dias   INT,
  ativo      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_kanban_fases_kanban ON public.kanban_fases(kanban_id);

COMMENT ON TABLE public.kanban_fases IS 'Fases/colunas de cada kanban.';

-- ─── Seed: Funil Step One ────────────────────────────────────────────────────
DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  -- Garante idempotência: insere o kanban apenas se ainda não existir
  INSERT INTO public.kanbans (nome, ordem, cor_hex, ativo)
  SELECT 'Funil Step One', 1, '#5B4CF5', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanbans WHERE nome = 'Funil Step One'
  )
  RETURNING id INTO v_kanban_id;

  -- Se já existia, busca o id
  IF v_kanban_id IS NULL THEN
    SELECT id INTO v_kanban_id FROM public.kanbans WHERE nome = 'Funil Step One';
  END IF;

  -- Insere as 7 fases apenas se ainda não existirem para este kanban
  INSERT INTO public.kanban_fases (kanban_id, nome, ordem, sla_dias, ativo)
  SELECT v_kanban_id, fase.nome, fase.ordem, fase.sla_dias, true
  FROM (
    VALUES
      ('Dados da Cidade',           1, 7),
      ('Lista de Condomínios',      2, 7),
      ('Dados dos Condomínios',     3, 10),
      ('Lotes disponíveis',         4, 7),
      ('Mapa de Competidores',      5, 7),
      ('BCA + Batalha de Casas',    6, 14),
      ('Hipóteses',                 7, 7)
  ) AS fase(nome, ordem, sla_dias)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND nome = fase.nome
  );
END;
$$;

-- ─── kanban_cards ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kanban_cards (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kanban_id     UUID        NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  fase_id       UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  franqueado_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo        TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'ativo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_kanban    ON public.kanban_cards(kanban_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_fase      ON public.kanban_cards(fase_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_franqueado ON public.kanban_cards(franqueado_id);

COMMENT ON TABLE public.kanban_cards IS 'Cards do kanban; franqueado_id aponta para o dono do card.';

-- ─── RLS: kanban_cards ───────────────────────────────────────────────────────
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

-- Leitura: dono do card OU admin/consultor
DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;
CREATE POLICY "kanban_cards_select"
  ON public.kanban_cards FOR SELECT
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- Inserção: dono do card (franqueado_id deve ser o próprio usuário) OU admin/consultor
DROP POLICY IF EXISTS "kanban_cards_insert" ON public.kanban_cards;
CREATE POLICY "kanban_cards_insert"
  ON public.kanban_cards FOR INSERT
  WITH CHECK (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- Atualização e exclusão: mesmo critério
DROP POLICY IF EXISTS "kanban_cards_update" ON public.kanban_cards;
CREATE POLICY "kanban_cards_update"
  ON public.kanban_cards FOR UPDATE
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "kanban_cards_delete" ON public.kanban_cards;
CREATE POLICY "kanban_cards_delete"
  ON public.kanban_cards FOR DELETE
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- ─── RLS: kanbans (leitura pública, escrita só admin) ─────────────────────
ALTER TABLE public.kanbans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanbans_select" ON public.kanbans;
CREATE POLICY "kanbans_select"
  ON public.kanbans FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "kanbans_admin" ON public.kanbans;
CREATE POLICY "kanbans_admin"
  ON public.kanbans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- ─── RLS: kanban_fases (leitura pública, escrita só admin) ────────────────
ALTER TABLE public.kanban_fases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_fases_select" ON public.kanban_fases;
CREATE POLICY "kanban_fases_select"
  ON public.kanban_fases FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "kanban_fases_admin" ON public.kanban_fases;
CREATE POLICY "kanban_fases_admin"
  ON public.kanban_fases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );
