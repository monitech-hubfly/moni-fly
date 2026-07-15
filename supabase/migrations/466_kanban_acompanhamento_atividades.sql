-- ─── 466: Tabela kanban_acompanhamento_atividades ─────────────────────────────
-- Atividades de acompanhamento por card (múltiplas, substituindo proxima_atividade único).

CREATE TABLE IF NOT EXISTS public.kanban_acompanhamento_atividades (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id          UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_id          UUID        REFERENCES public.kanban_fases(id) ON DELETE SET NULL,
  descricao        TEXT,
  prazo            DATE,
  responsavel_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  origem           TEXT        NOT NULL DEFAULT 'manual',
  concluido        BOOLEAN     NOT NULL DEFAULT false,
  concluido_em     TIMESTAMPTZ,
  concluido_por    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ordem            INTEGER,
  arquivado        BOOLEAN     NOT NULL DEFAULT false,
  arquivado_em     TIMESTAMPTZ,
  arquivado_por    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  motivo_arquivamento TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para filtros frequentes
CREATE INDEX IF NOT EXISTS idx_kanban_acomp_atv_card_id
  ON public.kanban_acompanhamento_atividades (card_id);

CREATE INDEX IF NOT EXISTS idx_kanban_acomp_atv_fase_id
  ON public.kanban_acompanhamento_atividades (fase_id);

CREATE INDEX IF NOT EXISTS idx_kanban_acomp_atv_responsavel_id
  ON public.kanban_acompanhamento_atividades (responsavel_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.kanban_acompanhamento_atividades ENABLE ROW LEVEL SECURITY;

-- SELECT: admin/consultor, franqueado do card, responsável ou criador
DROP POLICY IF EXISTS kanban_acomp_atv_select ON public.kanban_acompanhamento_atividades;
CREATE POLICY kanban_acomp_atv_select ON public.kanban_acompanhamento_atividades
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_acompanhamento_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR kanban_acompanhamento_atividades.responsavel_id = auth.uid()
    OR kanban_acompanhamento_atividades.criado_por    = auth.uid()
  );

-- INSERT: mesma lógica
DROP POLICY IF EXISTS kanban_acomp_atv_insert ON public.kanban_acompanhamento_atividades;
CREATE POLICY kanban_acomp_atv_insert ON public.kanban_acompanhamento_atividades
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_acompanhamento_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR kanban_acompanhamento_atividades.responsavel_id = auth.uid()
    OR kanban_acompanhamento_atividades.criado_por    = auth.uid()
  );

-- UPDATE: mesma lógica
DROP POLICY IF EXISTS kanban_acomp_atv_update ON public.kanban_acompanhamento_atividades;
CREATE POLICY kanban_acomp_atv_update ON public.kanban_acompanhamento_atividades
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_acompanhamento_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR kanban_acompanhamento_atividades.responsavel_id = auth.uid()
    OR kanban_acompanhamento_atividades.criado_por    = auth.uid()
  );

-- DELETE: mesma lógica
DROP POLICY IF EXISTS kanban_acomp_atv_delete ON public.kanban_acompanhamento_atividades;
CREATE POLICY kanban_acomp_atv_delete ON public.kanban_acompanhamento_atividades
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_acompanhamento_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR kanban_acompanhamento_atividades.responsavel_id = auth.uid()
    OR kanban_acompanhamento_atividades.criado_por    = auth.uid()
  );

-- Permissões para role authenticated
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.kanban_acompanhamento_atividades TO authenticated;
