-- 534: Cadastro de corretores na Rede Casa Moní (`rede_corretores`).
-- Idempotente. Frank sem acesso (RLS admin|team).

CREATE TABLE IF NOT EXISTS public.rede_corretores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  n_corretor            TEXT,
  ordem                 INT DEFAULT 0,
  nome                  TEXT NOT NULL,
  cpf_cnpj              TEXT,
  creci_numero          TEXT,
  creci_uf              TEXT,
  creci_tipo_registro   TEXT
                          CHECK (
                            creci_tipo_registro IS NULL
                            OR creci_tipo_registro IN (
                              'estagiario',
                              'tecnico_transacoes',
                              'corretor_titular'
                            )
                          ),
  creci_validade        DATE,
  email                 TEXT,
  telefone              TEXT,
  conta_banco_codigo    TEXT,
  conta_banco_nome      TEXT,
  conta_agencia         TEXT,
  conta_numero          TEXT,
  conta_tipo            TEXT
                          CHECK (conta_tipo IS NULL OR conta_tipo IN ('corrente', 'poupanca')),
  conta_titular         TEXT,
  conta_pix_tipo        TEXT
                          CHECK (
                            conta_pix_tipo IS NULL
                            OR conta_pix_tipo IN ('cpf_cnpj', 'email', 'telefone', 'aleatoria')
                          ),
  conta_pix_chave       TEXT,
  status                TEXT DEFAULT 'em_analise'
                          CHECK (status IN ('ativo', 'inativo', 'em_analise')),
  observacoes           TEXT,
  criado_por            UUID REFERENCES auth.users(id),
  ultima_atualizacao_por UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rede_corretores_status ON public.rede_corretores (status);
CREATE INDEX IF NOT EXISTS idx_rede_corretores_n_corretor ON public.rede_corretores (n_corretor);
CREATE INDEX IF NOT EXISTS idx_rede_corretores_cpf_cnpj ON public.rede_corretores (cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_rede_corretores_creci_uf ON public.rede_corretores (creci_uf);

COMMENT ON TABLE public.rede_corretores IS
  'Corretores de imóveis da Rede Casa Moní (gestão interna). Frank não tem acesso.';

ALTER TABLE public.rede_corretores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rede_corretores_select_admin_team" ON public.rede_corretores;
CREATE POLICY "rede_corretores_select_admin_team"
  ON public.rede_corretores
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

DROP POLICY IF EXISTS "rede_corretores_insert_admin_team" ON public.rede_corretores;
CREATE POLICY "rede_corretores_insert_admin_team"
  ON public.rede_corretores
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

DROP POLICY IF EXISTS "rede_corretores_update_admin_team" ON public.rede_corretores;
CREATE POLICY "rede_corretores_update_admin_team"
  ON public.rede_corretores
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

DROP POLICY IF EXISTS "rede_corretores_delete_admin_team" ON public.rede_corretores;
CREATE POLICY "rede_corretores_delete_admin_team"
  ON public.rede_corretores
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rede_corretores TO authenticated;

NOTIFY pgrst, 'reload schema';
