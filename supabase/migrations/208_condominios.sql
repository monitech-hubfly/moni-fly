-- 208: Cadastro de condomínios (rede). Admin/team CRUD; Frank somente leitura.

CREATE TABLE IF NOT EXISTS public.condominios (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                          TEXT NOT NULL,
  endereco                      TEXT,
  numero                        TEXT,
  cep                           TEXT,
  cidade                        TEXT,
  estado                        TEXT,
  ticket_medio_lote             NUMERIC(15, 2),
  ticket_medio_casas            NUMERIC(15, 2),
  ticket_medio_casas_rsm2       NUMERIC(15, 2),
  estimativa_casas_vendidas_ano INTEGER,
  criado_por                    UUID REFERENCES auth.users(id),
  created_at                    TIMESTAMPTZ DEFAULT now(),
  updated_at                    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condominios_estado_cidade ON public.condominios (estado, cidade);
CREATE INDEX IF NOT EXISTS idx_condominios_nome ON public.condominios (nome);

COMMENT ON TABLE public.condominios IS
  'Condomínios da rede. Frank: somente SELECT; admin/team: CRUD.';

ALTER TABLE public.condominios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "condominios_select_admin_team" ON public.condominios;
CREATE POLICY "condominios_select_admin_team"
  ON public.condominios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "condominios_select_frank" ON public.condominios;
CREATE POLICY "condominios_select_frank"
  ON public.condominios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('frank', 'franqueado')
    )
  );

DROP POLICY IF EXISTS "condominios_insert_admin_team" ON public.condominios;
CREATE POLICY "condominios_insert_admin_team"
  ON public.condominios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "condominios_update_admin_team" ON public.condominios;
CREATE POLICY "condominios_update_admin_team"
  ON public.condominios
  FOR UPDATE
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

DROP POLICY IF EXISTS "condominios_delete_admin_team" ON public.condominios;
CREATE POLICY "condominios_delete_admin_team"
  ON public.condominios
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominios TO authenticated;
