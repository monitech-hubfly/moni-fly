-- 435: Cadastros Moní Capital (Broker + Investidor) — standalone, vinculado ao Funil Funding.

CREATE TABLE IF NOT EXISTS public.moni_capital_cadastros (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  n_cadastro          TEXT NOT NULL,
  ordem               INT NOT NULL DEFAULT 0,
  broker_nome         TEXT,
  broker_email        TEXT,
  broker_telefone     TEXT,
  investidor_nome     TEXT,
  investidor_email    TEXT,
  investidor_telefone TEXT,
  kanban_card_id      UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  criado_por          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT moni_capital_cadastros_n_cadastro_unique UNIQUE (n_cadastro)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_moni_capital_cadastros_kanban_card_id
  ON public.moni_capital_cadastros (kanban_card_id)
  WHERE kanban_card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_moni_capital_cadastros_ordem
  ON public.moni_capital_cadastros (ordem);

CREATE INDEX IF NOT EXISTS idx_moni_capital_cadastros_broker_email
  ON public.moni_capital_cadastros (lower(trim(broker_email)))
  WHERE broker_email IS NOT NULL AND trim(broker_email) <> '';

CREATE INDEX IF NOT EXISTS idx_moni_capital_cadastros_investidor_email
  ON public.moni_capital_cadastros (lower(trim(investidor_email)))
  WHERE investidor_email IS NOT NULL AND trim(investidor_email) <> '';

COMMENT ON TABLE public.moni_capital_cadastros IS
  'Cadastros Moní Capital (Broker + Investidor). MC0000 reservado; sequência inicia em MC0001.';

-- Vínculo bidirecional com cards do Funil Funding (padrão franqueado_spe).
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS moni_capital_cadastro_id UUID REFERENCES public.moni_capital_cadastros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_moni_capital_cadastro_id
  ON public.kanban_cards (moni_capital_cadastro_id)
  WHERE moni_capital_cadastro_id IS NOT NULL;

COMMENT ON COLUMN public.kanban_cards.moni_capital_cadastro_id IS
  'Cadastro Moní Capital vinculado (Funil Funding).';

ALTER TABLE public.moni_capital_cadastros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moni_capital_cadastros_select_admin_team" ON public.moni_capital_cadastros;
CREATE POLICY "moni_capital_cadastros_select_admin_team"
  ON public.moni_capital_cadastros FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "moni_capital_cadastros_insert_admin_team" ON public.moni_capital_cadastros;
CREATE POLICY "moni_capital_cadastros_insert_admin_team"
  ON public.moni_capital_cadastros FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "moni_capital_cadastros_update_admin_team" ON public.moni_capital_cadastros;
CREATE POLICY "moni_capital_cadastros_update_admin_team"
  ON public.moni_capital_cadastros FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "moni_capital_cadastros_delete_admin_team" ON public.moni_capital_cadastros;
CREATE POLICY "moni_capital_cadastros_delete_admin_team"
  ON public.moni_capital_cadastros FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.moni_capital_cadastros TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('435', 'moni_capital_cadastros')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
