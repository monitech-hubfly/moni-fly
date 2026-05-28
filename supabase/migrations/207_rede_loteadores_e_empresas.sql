-- 207: Cadastro de loteadores + empresas (incorporadora/gestora) por franqueado na rede.

-- ─── rede_loteadores ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_loteadores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                TEXT NOT NULL,
  cnpj                TEXT,
  cidade              TEXT,
  estado              TEXT,
  contato_nome        TEXT,
  contato_telefone    TEXT,
  contato_email       TEXT,
  portfolio_descricao TEXT,
  status              TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'em_analise')),
  observacoes         TEXT,
  criado_por          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rede_loteadores_status ON public.rede_loteadores (status);
CREATE INDEX IF NOT EXISTS idx_rede_loteadores_estado_cidade ON public.rede_loteadores (estado, cidade);

COMMENT ON TABLE public.rede_loteadores IS
  'Loteadores da rede (gestão interna). Frank não tem acesso.';

ALTER TABLE public.rede_loteadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rede_loteadores_select_admin_team" ON public.rede_loteadores;
CREATE POLICY "rede_loteadores_select_admin_team"
  ON public.rede_loteadores
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

DROP POLICY IF EXISTS "rede_loteadores_insert_admin_team" ON public.rede_loteadores;
CREATE POLICY "rede_loteadores_insert_admin_team"
  ON public.rede_loteadores
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

DROP POLICY IF EXISTS "rede_loteadores_update_admin_team" ON public.rede_loteadores;
CREATE POLICY "rede_loteadores_update_admin_team"
  ON public.rede_loteadores
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

DROP POLICY IF EXISTS "rede_loteadores_delete_admin_team" ON public.rede_loteadores;
CREATE POLICY "rede_loteadores_delete_admin_team"
  ON public.rede_loteadores
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rede_loteadores TO authenticated;

-- ─── franqueado_empresas ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.franqueado_empresas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rede_franqueado_id    UUID NOT NULL REFERENCES public.rede_franqueados(id) ON DELETE CASCADE,
  tipo                  TEXT NOT NULL CHECK (tipo IN ('incorporadora', 'gestora')),
  razao_social          TEXT,
  cnpj                  TEXT,
  inscricao_municipal   TEXT,
  inscricao_estadual    TEXT,
  data_abertura         DATE,
  status                TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa', 'em_abertura')),
  conta_banco           TEXT,
  conta_agencia         TEXT,
  conta_numero          TEXT,
  conta_tipo            TEXT,
  observacoes           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (rede_franqueado_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_franqueado_empresas_rede_franqueado_id
  ON public.franqueado_empresas (rede_franqueado_id);

COMMENT ON TABLE public.franqueado_empresas IS
  'Dados cadastrais da incorporadora e da gestora por linha em rede_franqueados (máx. uma de cada tipo).';
COMMENT ON COLUMN public.franqueado_empresas.rede_franqueado_id IS
  'FK para rede_franqueados.id; Frank acessa via profiles.rede_franqueado_id.';

ALTER TABLE public.franqueado_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "franqueado_empresas_select_admin_team" ON public.franqueado_empresas;
CREATE POLICY "franqueado_empresas_select_admin_team"
  ON public.franqueado_empresas
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

-- Frank: somente leitura das empresas da própria linha na rede (profiles.rede_franqueado_id).
DROP POLICY IF EXISTS "franqueado_empresas_select_frank_own" ON public.franqueado_empresas;
CREATE POLICY "franqueado_empresas_select_frank_own"
  ON public.franqueado_empresas
  FOR SELECT
  TO authenticated
  USING (
    rede_franqueado_id IN (
      SELECT p.rede_franqueado_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id IS NOT NULL
        AND p.role IN ('frank', 'franqueado')
    )
  );

DROP POLICY IF EXISTS "franqueado_empresas_insert_admin_team" ON public.franqueado_empresas;
CREATE POLICY "franqueado_empresas_insert_admin_team"
  ON public.franqueado_empresas
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

DROP POLICY IF EXISTS "franqueado_empresas_update_admin_team" ON public.franqueado_empresas;
CREATE POLICY "franqueado_empresas_update_admin_team"
  ON public.franqueado_empresas
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

DROP POLICY IF EXISTS "franqueado_empresas_delete_admin_team" ON public.franqueado_empresas;
CREATE POLICY "franqueado_empresas_delete_admin_team"
  ON public.franqueado_empresas
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

GRANT SELECT ON public.franqueado_empresas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.franqueado_empresas TO authenticated;
