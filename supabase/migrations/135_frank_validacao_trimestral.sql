-- Validação trimestral de dados (Frank) + vínculo perfil ↔ rede_franqueados + RLS

-- ─── 1. Tabela de validações ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.frank_validacoes_dados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frank_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  validado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (frank_id, periodo)
);

COMMENT ON TABLE public.frank_validacoes_dados IS
  'Confirmação trimestral de dados do franqueado (periodo ex.: 2026-01, 2026-04, 2026-07, 2026-11).';

CREATE INDEX IF NOT EXISTS idx_frank_validacoes_frank ON public.frank_validacoes_dados (frank_id);
CREATE INDEX IF NOT EXISTS idx_frank_validacoes_periodo ON public.frank_validacoes_dados (periodo);

ALTER TABLE public.frank_validacoes_dados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "frank_validacoes_select_own" ON public.frank_validacoes_dados;
CREATE POLICY "frank_validacoes_select_own"
  ON public.frank_validacoes_dados FOR SELECT TO authenticated
  USING (frank_id = auth.uid());

DROP POLICY IF EXISTS "frank_validacoes_insert_own" ON public.frank_validacoes_dados;
CREATE POLICY "frank_validacoes_insert_own"
  ON public.frank_validacoes_dados FOR INSERT TO authenticated
  WITH CHECK (frank_id = auth.uid());

DROP POLICY IF EXISTS "frank_validacoes_update_own" ON public.frank_validacoes_dados;
CREATE POLICY "frank_validacoes_update_own"
  ON public.frank_validacoes_dados FOR UPDATE TO authenticated
  USING (frank_id = auth.uid())
  WITH CHECK (frank_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.frank_validacoes_dados TO authenticated;

-- ─── 2. Perfil → linha da rede (cadastro portal) ─────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rede_franqueado_id UUID REFERENCES public.rede_franqueados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.rede_franqueado_id IS
  'Linha em rede_franqueados associada ao franqueado (portal).';

CREATE INDEX IF NOT EXISTS idx_profiles_rede_franqueado_id ON public.profiles (rede_franqueado_id);

-- ─── 3. Frank pode atualizar a própria linha na rede ────────────────────────
DROP POLICY IF EXISTS "rede_franqueados_update_frank_own" ON public.rede_franqueados;
CREATE POLICY "rede_franqueados_update_frank_own"
  ON public.rede_franqueados FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT p.rede_franqueado_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id IS NOT NULL
    )
  )
  WITH CHECK (
    id IN (
      SELECT p.rede_franqueado_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id IS NOT NULL
    )
  );

-- ─── 4. Convites Frank: admin ou time (legado consultor → team na 132) ───────
DROP POLICY IF EXISTS "convites_frank_select_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_select_admin"
  ON public.convites_frank FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_insert_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_insert_admin"
  ON public.convites_frank FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_update_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_update_admin"
  ON public.convites_frank FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );
