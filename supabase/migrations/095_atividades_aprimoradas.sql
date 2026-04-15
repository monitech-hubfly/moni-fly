-- ─── 095: Atividades aprimoradas — Sprint C ──────────────────────────────────
-- "Atividades" neste projeto = tabela public.processo_card_checklist
-- Adiciona colunas de contexto kanban sem perder dados existentes.
-- Idempotente: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ─── 1. Novas colunas em processo_card_checklist ──────────────────────────────
-- Estado atual da tabela (migrations 045 → 090):
--   id, processo_id, etapa_painel, titulo, concluido, ordem,
--   created_at, updated_at, prazo, responsavel_nome, status,
--   time_nome, times_nomes, responsaveis_nomes

ALTER TABLE public.processo_card_checklist
  ADD COLUMN IF NOT EXISTS kanban_id     UUID REFERENCES public.kanbans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fase_id       UUID REFERENCES public.kanban_fases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_id       UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS franqueado_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condominio    TEXT,
  ADD COLUMN IF NOT EXISTS lote          TEXT,
  ADD COLUMN IF NOT EXISTS quadra        TEXT;

CREATE INDEX IF NOT EXISTS idx_pcc_kanban     ON public.processo_card_checklist(kanban_id);
CREATE INDEX IF NOT EXISTS idx_pcc_fase        ON public.processo_card_checklist(fase_id);
CREATE INDEX IF NOT EXISTS idx_pcc_card        ON public.processo_card_checklist(card_id);
CREATE INDEX IF NOT EXISTS idx_pcc_franqueado  ON public.processo_card_checklist(franqueado_id);

-- ─── 2. atividade_times ───────────────────────────────────────────────────────
-- Tabela de junction: times vinculados a uma atividade (processo_card_checklist).
CREATE TABLE IF NOT EXISTS public.atividade_times (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id UUID NOT NULL REFERENCES public.processo_card_checklist(id) ON DELETE CASCADE,
  time_nome    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_atividade_times_atividade ON public.atividade_times(atividade_id);

COMMENT ON TABLE public.atividade_times IS
  'Times vinculados a uma atividade (processo_card_checklist). '
  'Complementa a coluna legada times_nomes[] da tabela principal.';

-- ─── 3. atividade_responsaveis ────────────────────────────────────────────────
-- Tabela de junction: responsáveis por atividade com referência a auth.users.
CREATE TABLE IF NOT EXISTS public.atividade_responsaveis (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id UUID NOT NULL REFERENCES public.processo_card_checklist(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (atividade_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_atividade_resp_atividade ON public.atividade_responsaveis(atividade_id);
CREATE INDEX IF NOT EXISTS idx_atividade_resp_user      ON public.atividade_responsaveis(user_id);

COMMENT ON TABLE public.atividade_responsaveis IS
  'Responsáveis por atividade com FK para auth.users. '
  'Complementa a coluna legada responsaveis_nomes[] da tabela principal.';

-- ─── 4. duvidas ───────────────────────────────────────────────────────────────
-- Espelha a estrutura de processo_card_checklist com tipo = 'duvida'.
CREATE TABLE IF NOT EXISTS public.duvidas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id    UUID        REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  kanban_id      UUID        REFERENCES public.kanbans(id) ON DELETE SET NULL,
  fase_id        UUID        REFERENCES public.kanban_fases(id) ON DELETE SET NULL,
  card_id        UUID        REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  franqueado_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  etapa_painel   TEXT,
  titulo         TEXT        NOT NULL,
  descricao      TEXT,
  condominio     TEXT,
  lote           TEXT,
  quadra         TEXT,
  status         TEXT        NOT NULL DEFAULT 'aberta'
                             CHECK (status IN ('aberta', 'respondida', 'fechada')),
  tipo           TEXT        NOT NULL DEFAULT 'duvida',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_duvidas_processo   ON public.duvidas(processo_id);
CREATE INDEX IF NOT EXISTS idx_duvidas_kanban      ON public.duvidas(kanban_id);
CREATE INDEX IF NOT EXISTS idx_duvidas_fase         ON public.duvidas(fase_id);
CREATE INDEX IF NOT EXISTS idx_duvidas_card         ON public.duvidas(card_id);
CREATE INDEX IF NOT EXISTS idx_duvidas_franqueado   ON public.duvidas(franqueado_id);

COMMENT ON TABLE public.duvidas IS
  'Dúvidas de franqueados. Espelha estrutura de processo_card_checklist '
  'com tipo = duvida e campos de status próprios.';

-- ─── RLS: atividade_times ─────────────────────────────────────────────────────
ALTER TABLE public.atividade_times ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atividade_times_select" ON public.atividade_times;
CREATE POLICY "atividade_times_select"
  ON public.atividade_times FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "atividade_times_write" ON public.atividade_times;
CREATE POLICY "atividade_times_write"
  ON public.atividade_times FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- ─── RLS: atividade_responsaveis ─────────────────────────────────────────────
ALTER TABLE public.atividade_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atividade_responsaveis_select" ON public.atividade_responsaveis;
CREATE POLICY "atividade_responsaveis_select"
  ON public.atividade_responsaveis FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "atividade_responsaveis_write" ON public.atividade_responsaveis;
CREATE POLICY "atividade_responsaveis_write"
  ON public.atividade_responsaveis FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- ─── RLS: duvidas ─────────────────────────────────────────────────────────────
ALTER TABLE public.duvidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duvidas_select" ON public.duvidas;
CREATE POLICY "duvidas_select"
  ON public.duvidas FOR SELECT
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "duvidas_insert" ON public.duvidas;
CREATE POLICY "duvidas_insert"
  ON public.duvidas FOR INSERT
  WITH CHECK (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "duvidas_update" ON public.duvidas;
CREATE POLICY "duvidas_update"
  ON public.duvidas FOR UPDATE
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- ─── GRANTs ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividade_times        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividade_responsaveis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duvidas                 TO authenticated;
