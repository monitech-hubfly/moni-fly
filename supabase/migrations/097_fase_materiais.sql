-- ─── 097: Materiais e instruções por fase — Sprint E ─────────────────────────
-- Idempotente: CREATE TABLE IF NOT EXISTS.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ─── fase_materiais ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fase_materiais (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id    UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  kanban_id  UUID        NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  tipo       TEXT        NOT NULL CHECK (tipo IN ('instrucao', 'material')),
  titulo     TEXT        NOT NULL,
  conteudo   TEXT,
  url        TEXT,
  criado_por UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fase_materiais_fase   ON public.fase_materiais(fase_id);
CREATE INDEX IF NOT EXISTS idx_fase_materiais_kanban ON public.fase_materiais(kanban_id);

COMMENT ON TABLE public.fase_materiais IS
  'Materiais e instruções vinculados a fases de kanban. '
  'tipo = instrucao (texto orientativo) ou material (link/arquivo).';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.fase_materiais ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado
DROP POLICY IF EXISTS "fase_materiais_select" ON public.fase_materiais;
CREATE POLICY "fase_materiais_select"
  ON public.fase_materiais FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Escrita: apenas admin e consultor
DROP POLICY IF EXISTS "fase_materiais_insert" ON public.fase_materiais;
CREATE POLICY "fase_materiais_insert"
  ON public.fase_materiais FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "fase_materiais_update" ON public.fase_materiais;
CREATE POLICY "fase_materiais_update"
  ON public.fase_materiais FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "fase_materiais_delete" ON public.fase_materiais;
CREATE POLICY "fase_materiais_delete"
  ON public.fase_materiais FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- GRANTs
GRANT SELECT ON public.fase_materiais TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fase_materiais TO authenticated;
