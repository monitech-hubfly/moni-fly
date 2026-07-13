-- 260: Lotes vinculados ao cadastro de condomínios (Rede → Condomínios).

CREATE TABLE IF NOT EXISTS public.condominios_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL REFERENCES public.condominios (id) ON DELETE CASCADE,
  quadra TEXT,
  lote TEXT,
  area_m2 NUMERIC(12, 2),
  valor NUMERIC(14, 2),
  situacao_documental TEXT,
  fotos_path TEXT,
  vista_privilegiada BOOLEAN NOT NULL DEFAULT false,
  perto_area_verde BOOLEAN NOT NULL DEFAULT false,
  muro BOOLEAN NOT NULL DEFAULT false,
  perto_area_convivencia BOOLEAN NOT NULL DEFAULT false,
  perto_lixeira BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  kanban_card_id UUID REFERENCES public.kanban_cards (id) ON DELETE SET NULL,
  criado_por UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condominios_lotes_condominio_id
  ON public.condominios_lotes (condominio_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_condominios_lotes_kanban_card_id
  ON public.condominios_lotes (kanban_card_id)
  WHERE kanban_card_id IS NOT NULL;

COMMENT ON TABLE public.condominios_lotes IS
  'Lotes do funil Step One vinculados ao cadastro central em condominios.';

ALTER TABLE public.condominios_lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "condominios_lotes_select_authenticated" ON public.condominios_lotes;
CREATE POLICY "condominios_lotes_select_authenticated"
  ON public.condominios_lotes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "condominios_lotes_insert_admin_team" ON public.condominios_lotes;
CREATE POLICY "condominios_lotes_insert_admin_team"
  ON public.condominios_lotes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "condominios_lotes_update_admin_team" ON public.condominios_lotes;
CREATE POLICY "condominios_lotes_update_admin_team"
  ON public.condominios_lotes FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "condominios_lotes_delete_admin_team" ON public.condominios_lotes;
CREATE POLICY "condominios_lotes_delete_admin_team"
  ON public.condominios_lotes FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominios_lotes TO authenticated;
