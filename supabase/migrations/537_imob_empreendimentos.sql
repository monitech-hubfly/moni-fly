-- 537: Empreendimentos na Rede Casa Moní + vínculo corretor ↔ empreendimento.
-- Leitura pública (QR / cliente); escrita admin|team.
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.imob_empreendimentos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  ativo      BOOLEAN DEFAULT true,
  tipologias JSONB DEFAULT '[]'::jsonb,
  -- formato: [{"cod":"C1","nome":"Casa Varanda","specs":"120m² · 3 dorms","preco":450000,"img_url":""}]
  opcionais  JSONB DEFAULT '[]'::jsonb,
  -- formato: [{"id":"solar","icon":"☀️","nome":"Energia Solar","desc":"Painel fotovoltaico","preco":25000}]
  condicoes  JSONB DEFAULT '[]'::jsonb,
  -- formato: [{"label":"À vista","valor":"R$ 450.000"},{"label":"12x sem juros","valor":"R$ 39.800/mês"}]
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imob_empreendimentos_ativo
  ON public.imob_empreendimentos (ativo)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_imob_empreendimentos_slug
  ON public.imob_empreendimentos (slug);

COMMENT ON TABLE public.imob_empreendimentos IS
  'Empreendimentos cadastrados na Rede Casa Moní (tipologias/opcionais/condições em JSONB).';

CREATE TABLE IF NOT EXISTS public.imob_corretor_empreendimentos (
  corretor_id       UUID NOT NULL REFERENCES public.rede_corretores(id) ON DELETE CASCADE,
  empreendimento_id UUID NOT NULL REFERENCES public.imob_empreendimentos(id) ON DELETE CASCADE,
  PRIMARY KEY (corretor_id, empreendimento_id)
);

CREATE INDEX IF NOT EXISTS idx_imob_corretor_empreendimentos_emp
  ON public.imob_corretor_empreendimentos (empreendimento_id);

COMMENT ON TABLE public.imob_corretor_empreendimentos IS
  'Vínculo corretor ↔ empreendimentos (N:N).';

-- ─── RLS imob_empreendimentos ────────────────────────────────────────────────
ALTER TABLE public.imob_empreendimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emp_read_anon" ON public.imob_empreendimentos;
CREATE POLICY "emp_read_anon"
  ON public.imob_empreendimentos
  FOR SELECT
  TO anon
  USING (ativo = true);

DROP POLICY IF EXISTS "emp_read_authenticated" ON public.imob_empreendimentos;
CREATE POLICY "emp_read_authenticated"
  ON public.imob_empreendimentos
  FOR SELECT
  TO authenticated
  USING (
    ativo = true
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "emp_write_admin_team" ON public.imob_empreendimentos;
CREATE POLICY "emp_write_admin_team"
  ON public.imob_empreendimentos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team')
    )
  );

-- ─── RLS imob_corretor_empreendimentos ───────────────────────────────────────
ALTER TABLE public.imob_corretor_empreendimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "corretor_emp_read_anon" ON public.imob_corretor_empreendimentos;
CREATE POLICY "corretor_emp_read_anon"
  ON public.imob_corretor_empreendimentos
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "corretor_emp_read_authenticated" ON public.imob_corretor_empreendimentos;
CREATE POLICY "corretor_emp_read_authenticated"
  ON public.imob_corretor_empreendimentos
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "corretor_emp_write_admin_team" ON public.imob_corretor_empreendimentos;
CREATE POLICY "corretor_emp_write_admin_team"
  ON public.imob_corretor_empreendimentos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team')
    )
  );

GRANT SELECT ON public.imob_empreendimentos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imob_empreendimentos TO authenticated, service_role;

GRANT SELECT ON public.imob_corretor_empreendimentos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imob_corretor_empreendimentos TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
