-- 568: Controladoria — tabela de entidades configuráveis para disparo mensal.
-- Idempotente. Seed com as 12 entidades validadas (Rede de Franqueados — set/26).

CREATE TABLE IF NOT EXISTS public.controladoria_entidades_cfg (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  subtipo    text,
  tipo       text NOT NULL CHECK (tipo IN ('Gestora', 'Empresa adicional', 'SPE', 'Funcionário', 'Obra')),
  ativo      boolean NOT NULL DEFAULT true,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

-- RLS: leitura para autenticados, escrita para admin/team via SUPABASE_SERVICE_ROLE
ALTER TABLE public.controladoria_entidades_cfg ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'controladoria_entidades_cfg'
      AND policyname = 'ctrl_entidades_select_authenticated'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY ctrl_entidades_select_authenticated
      ON public.controladoria_entidades_cfg
      FOR SELECT
      TO authenticated
      USING (true)
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'controladoria_entidades_cfg'
      AND policyname = 'ctrl_entidades_update_admin'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY ctrl_entidades_update_admin
      ON public.controladoria_entidades_cfg
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'team')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'team')
        )
      )
    $pol$;
  END IF;
END $$;

-- ─── Seed — entidades validadas (Rede de Franqueados, set/26) ─────────────────
-- Upsert por nome+tipo para idempotência.
INSERT INTO public.controladoria_entidades_cfg (nome, subtipo, tipo, ativo)
VALUES
  -- Gestora
  ('Casa Moní',                 'FK0000',              'Gestora',           true),
  -- Empresas adicionais
  ('Moní Negócios',             'Empresa adicional',   'Empresa adicional', true),
  ('Loja Moní',                 'Empresa adicional',   'Empresa adicional', true),
  ('Griffon Consultoria',       'Holding',             'Empresa adicional', true),
  ('Franchising',               'Empresa adicional',   'Empresa adicional', true),
  -- SPEs
  ('Caleiras',                  'SPE por projeto',     'SPE',               true),
  ('Gênesis',                   'SPE por projeto',     'SPE',               true),
  ('Griffon Campinas',          'SPE por projeto',     'SPE',               true),
  ('Moní 3',                    'SPE por projeto',     'SPE',               true),
  ('Moní Sta. Mônica',          'SPE por projeto',     'SPE',               false),
  ('Omy Campinas',              'SPE por projeto',     'SPE',               true),
  ('Moní Capital',              'SPE por projeto',     'SPE',               true),
  -- Fiscal — Funcionários (placeholders; fonte a confirmar com Fe)
  ('Isa',                       'CLT',                 'Funcionário',       true),
  ('Carol',                     'CLT',                 'Funcionário',       true),
  ('João',                      'PJ',                  'Funcionário',       true),
  ('Ana',                       'CLT',                 'Funcionário',       false),
  ('Pedro',                     'PJ',                  'Funcionário',       true),
  -- Fiscal — Obras (placeholders)
  ('Emissão Rafa',              'Obra ativa',          'Obra',              true),
  ('DAN',                       'Obra ativa',          'Obra',              true)
ON CONFLICT DO NOTHING;

-- Garante que "Moní Sta. Mônica" permanece inativa no upsert
UPDATE public.controladoria_entidades_cfg
SET ativo = false
WHERE nome = 'Moní Sta. Mônica' AND tipo = 'SPE';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('568', 'controladoria_entidades_cfg')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
