-- ─── 096: SLA e arquivamento de cards — Sprint D ─────────────────────────────
-- Idempotente: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ─── 1. fase_sla ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fase_sla (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id   UUID    NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  kanban_id UUID    NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  sla_dias  INT     NOT NULL CHECK (sla_dias > 0),
  UNIQUE (fase_id, kanban_id)
);

CREATE INDEX IF NOT EXISTS idx_fase_sla_fase   ON public.fase_sla(fase_id);
CREATE INDEX IF NOT EXISTS idx_fase_sla_kanban ON public.fase_sla(kanban_id);

COMMENT ON TABLE public.fase_sla IS 'SLA configurável por fase/kanban (sobrescreve sla_dias da fase).';

-- ─── 2. card_arquivamento ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.card_arquivamento (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_id    UUID        REFERENCES public.kanban_fases(id) ON DELETE SET NULL,
  motivo     TEXT,
  data_acao  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_card_arquivamento_card ON public.card_arquivamento(card_id);
CREATE INDEX IF NOT EXISTS idx_card_arquivamento_user ON public.card_arquivamento(user_id);

COMMENT ON TABLE public.card_arquivamento IS 'Histórico de arquivamentos de cards.';

-- ─── 3. card_vinculos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.card_vinculos (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  card_origem_id    UUID    NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  card_destino_id   UUID    NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  kanban_origem     TEXT,
  kanban_destino    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (card_origem_id, card_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_card_vinculos_origem  ON public.card_vinculos(card_origem_id);
CREATE INDEX IF NOT EXISTS idx_card_vinculos_destino ON public.card_vinculos(card_destino_id);

COMMENT ON TABLE public.card_vinculos IS 'Vínculos entre cards de kanbans distintos ou do mesmo.';

-- ─── 4. Função: status SLA do card ───────────────────────────────────────────
-- Retorna: 'ok' | 'atencao' | 'atrasado'
-- Lógica:
--   dias_restantes > 1  → ok
--   dias_restantes = 1  → atencao  (D-1)
--   dias_restantes = 0  → atencao  (vence hoje)
--   dias_restantes < 0  → atrasado

CREATE OR REPLACE FUNCTION public.fn_card_sla_status(
  p_card_id    UUID,
  p_fase_id    UUID,
  p_kanban_id  UUID,
  p_created_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_sla_dias      INT;
  v_dias_corridos INT;
  v_dias_restantes INT;
BEGIN
  -- Prioridade 1: fase_sla (configuração específica)
  SELECT sla_dias INTO v_sla_dias
  FROM public.fase_sla
  WHERE fase_id = p_fase_id AND kanban_id = p_kanban_id
  LIMIT 1;

  -- Prioridade 2: sla_dias da própria kanban_fases
  IF v_sla_dias IS NULL THEN
    SELECT sla_dias INTO v_sla_dias
    FROM public.kanban_fases
    WHERE id = p_fase_id
    LIMIT 1;
  END IF;

  -- Sem SLA configurado → sempre ok
  IF v_sla_dias IS NULL OR v_sla_dias <= 0 THEN
    RETURN 'ok';
  END IF;

  v_dias_corridos  := EXTRACT(DAY FROM (now() - p_created_at))::INT;
  v_dias_restantes := v_sla_dias - v_dias_corridos;

  IF v_dias_restantes < 0 THEN
    RETURN 'atrasado';
  ELSIF v_dias_restantes <= 1 THEN
    RETURN 'atencao';
  ELSE
    RETURN 'ok';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_card_sla_status IS
  'Retorna ok | atencao | atrasado para um card. '
  'atencao = D-1 ou vence hoje; atrasado = SLA vencido.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.fase_sla          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_arquivamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_vinculos     ENABLE ROW LEVEL SECURITY;

-- fase_sla: leitura pública, escrita só admin/consultor
DROP POLICY IF EXISTS "fase_sla_select" ON public.fase_sla;
CREATE POLICY "fase_sla_select" ON public.fase_sla FOR SELECT USING (true);

DROP POLICY IF EXISTS "fase_sla_admin" ON public.fase_sla;
CREATE POLICY "fase_sla_admin"
  ON public.fase_sla FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'consultor')));

-- card_arquivamento: leitura para dono ou admin/consultor
DROP POLICY IF EXISTS "card_arquivamento_select" ON public.card_arquivamento;
CREATE POLICY "card_arquivamento_select"
  ON public.card_arquivamento FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'consultor'))
  );

DROP POLICY IF EXISTS "card_arquivamento_insert" ON public.card_arquivamento;
CREATE POLICY "card_arquivamento_insert"
  ON public.card_arquivamento FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- card_vinculos: leitura pública, escrita autenticada
DROP POLICY IF EXISTS "card_vinculos_select" ON public.card_vinculos;
CREATE POLICY "card_vinculos_select" ON public.card_vinculos FOR SELECT USING (true);

DROP POLICY IF EXISTS "card_vinculos_write" ON public.card_vinculos;
CREATE POLICY "card_vinculos_write"
  ON public.card_vinculos FOR ALL
  USING (auth.uid() IS NOT NULL);

-- GRANTs
GRANT SELECT ON public.fase_sla          TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fase_sla          TO authenticated;
GRANT SELECT, INSERT ON public.card_arquivamento TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.card_vinculos TO authenticated;
