-- 544: Simulador de Pagamentos (Incorporação em Nuvem).
-- Template por card do Funil Loteadores (Helena) ou standalone (kanban_card_id null).
-- N simulações por template (time interno ou lead via QR /simulador/[token]).
-- Idempotente. Aplicar só em DEV até a Ingrid revisar o vínculo no card.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ─── loteamento_simulador_templates ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loteamento_simulador_templates (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kanban_card_id                  UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  rede_loteador_id                UUID REFERENCES public.rede_loteadores(id) ON DELETE SET NULL,
  nome                            TEXT,
  pct_itbi                        NUMERIC NOT NULL DEFAULT 0,
  pct_taxa_plataforma             NUMERIC NOT NULL DEFAULT 0,
  pct_taxa_gestao                 NUMERIC NOT NULL DEFAULT 0,
  pct_lucro_loteadora             NUMERIC NOT NULL DEFAULT 0,
  pct_lucro_moni                  NUMERIC NOT NULL DEFAULT 0,
  pct_lucro_franqueado            NUMERIC NOT NULL DEFAULT 0,
  pct_impostos                    NUMERIC NOT NULL DEFAULT 0,
  pct_comissao_corretor           NUMERIC NOT NULL DEFAULT 0,
  taxa_juros_credito_ponte        NUMERIC NOT NULL DEFAULT 0,
  valor_lote_padrao               NUMERIC,
  premissa_entrada_lote_parcial   JSONB,
  premissa_entrada_lote_nao_pago  JSONB,
  prazo_desembolso_sugerido       INTEGER NOT NULL DEFAULT 7,
  curva_desembolso_override       JSONB,
  link_token                      TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by                      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by                      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT loteamento_simulador_templates_prazo_check
    CHECK (prazo_desembolso_sugerido >= 3),
  CONSTRAINT loteamento_simulador_templates_pct_itbi_check
    CHECK (pct_itbi >= 0),
  CONSTRAINT loteamento_simulador_templates_pct_plataforma_check
    CHECK (pct_taxa_plataforma >= 0),
  CONSTRAINT loteamento_simulador_templates_pct_gestao_check
    CHECK (pct_taxa_gestao >= 0),
  CONSTRAINT loteamento_simulador_templates_pct_lucro_loteadora_check
    CHECK (pct_lucro_loteadora >= 0),
  CONSTRAINT loteamento_simulador_templates_pct_lucro_moni_check
    CHECK (pct_lucro_moni >= 0),
  CONSTRAINT loteamento_simulador_templates_pct_lucro_franqueado_check
    CHECK (pct_lucro_franqueado >= 0),
  CONSTRAINT loteamento_simulador_templates_pct_impostos_check
    CHECK (pct_impostos >= 0),
  CONSTRAINT loteamento_simulador_templates_pct_comissao_check
    CHECK (pct_comissao_corretor >= 0),
  CONSTRAINT loteamento_simulador_templates_taxa_juros_check
    CHECK (taxa_juros_credito_ponte >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_loteamento_simulador_templates_card
  ON public.loteamento_simulador_templates (kanban_card_id)
  WHERE kanban_card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loteamento_simulador_templates_loteador
  ON public.loteamento_simulador_templates (rede_loteador_id)
  WHERE rede_loteador_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loteamento_simulador_templates_token
  ON public.loteamento_simulador_templates (link_token);

COMMENT ON TABLE public.loteamento_simulador_templates IS
  'Parâmetros-padrão do Simulador de Pagamentos. kanban_card_id null = uso standalone (sem card no Kanban).';
COMMENT ON COLUMN public.loteamento_simulador_templates.kanban_card_id IS
  'Card do Funil Loteadores (Helena). Null quando o time testa um negócio antes de entrar no Kanban.';
COMMENT ON COLUMN public.loteamento_simulador_templates.rede_loteador_id IS
  'Conveniência: loteador vinculado (espelha kanban_cards.rede_loteador_id quando houver card).';
COMMENT ON COLUMN public.loteamento_simulador_templates.nome IS
  'Rótulo opcional, útil sobretudo em templates standalone.';
COMMENT ON COLUMN public.loteamento_simulador_templates.pct_itbi IS
  'Fração decimal sobre o valor do lote (ex.: 0.03 = 3%).';
COMMENT ON COLUMN public.loteamento_simulador_templates.pct_taxa_plataforma IS
  'Fração decimal sobre base_taxas_lucros (custo casa + lote).';
COMMENT ON COLUMN public.loteamento_simulador_templates.pct_taxa_gestao IS
  'Fração decimal sobre base_taxas_lucros.';
COMMENT ON COLUMN public.loteamento_simulador_templates.pct_lucro_loteadora IS
  'Fração decimal sobre base_taxas_lucros.';
COMMENT ON COLUMN public.loteamento_simulador_templates.pct_lucro_moni IS
  'Fração decimal sobre base_taxas_lucros.';
COMMENT ON COLUMN public.loteamento_simulador_templates.pct_lucro_franqueado IS
  'Fração decimal sobre base_taxas_lucros.';
COMMENT ON COLUMN public.loteamento_simulador_templates.pct_impostos IS
  'Fração decimal sobre o VTP.';
COMMENT ON COLUMN public.loteamento_simulador_templates.pct_comissao_corretor IS
  'Fração decimal sobre o VTP (paga na entrada).';
COMMENT ON COLUMN public.loteamento_simulador_templates.taxa_juros_credito_ponte IS
  'Taxa mensal do crédito-ponte, fração decimal (ex.: 0.012 = 1,2% a.m.).';
COMMENT ON COLUMN public.loteamento_simulador_templates.valor_lote_padrao IS
  'Valor do lote sugerido ao abrir o simulador (editável na simulação).';
COMMENT ON COLUMN public.loteamento_simulador_templates.premissa_entrada_lote_parcial IS
  'Regra de entrada quando condicao_lote = parcial. Ex.: {"tipo":"percentual","valor":0.3} ou {"tipo":"valor_fixo","valor":50000}.';
COMMENT ON COLUMN public.loteamento_simulador_templates.premissa_entrada_lote_nao_pago IS
  'Premissa padrão do loteador quando condicao_lote = nao_pago. Mesmo formato JSONB da premissa parcial.';
COMMENT ON COLUMN public.loteamento_simulador_templates.prazo_desembolso_sugerido IS
  'Meses da curva de desembolso (default 7, mínimo 3).';
COMMENT ON COLUMN public.loteamento_simulador_templates.curva_desembolso_override IS
  'Override opcional da curva padrão de 7 etapas. Null = usar a curva canônica no código.';
COMMENT ON COLUMN public.loteamento_simulador_templates.link_token IS
  'Token da URL pública /simulador/[token] (QR do corretor). Reaproveitado ao salvar; único.';
COMMENT ON COLUMN public.loteamento_simulador_templates.created_by IS
  'profiles.id de quem criou o template (Helena / time).';

-- ─── simulacoes_pagamento ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.simulacoes_pagamento (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id              UUID NOT NULL REFERENCES public.loteamento_simulador_templates(id) ON DELETE RESTRICT,
  kanban_card_id           UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  rede_loteador_id         UUID REFERENCES public.rede_loteadores(id) ON DELETE SET NULL,
  created_by               UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  condicao_lote            TEXT NOT NULL CHECK (
    condicao_lote IN ('nao_pago', 'parcial', 'quitado', 'recurso_proprio')
  ),
  renda_informada_cliente  NUMERIC,
  inputs                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  resultado                JSONB NOT NULL DEFAULT '{}'::jsonb,
  alertas                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  status                   TEXT NOT NULL DEFAULT 'rascunho' CHECK (
    status IN ('rascunho', 'salva', 'pdf_gerado')
  ),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulacoes_pagamento_template
  ON public.simulacoes_pagamento (template_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulacoes_pagamento_card
  ON public.simulacoes_pagamento (kanban_card_id)
  WHERE kanban_card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_simulacoes_pagamento_status
  ON public.simulacoes_pagamento (status, created_at DESC);

COMMENT ON TABLE public.simulacoes_pagamento IS
  'Simulação de pagamento de um cliente sobre um template. N por template. created_by null = lead do QR público.';
COMMENT ON COLUMN public.simulacoes_pagamento.template_id IS
  'Template usado (snapshot dos percentuais vai em resultado/inputs no momento do cálculo).';
COMMENT ON COLUMN public.simulacoes_pagamento.kanban_card_id IS
  'Denormalizado do template no momento da gravação (pode ser null).';
COMMENT ON COLUMN public.simulacoes_pagamento.created_by IS
  'profiles.id quando o time salva logado; null quando o corretor externo envia pelo QR.';
COMMENT ON COLUMN public.simulacoes_pagamento.condicao_lote IS
  'nao_pago | parcial | quitado | recurso_proprio.';
COMMENT ON COLUMN public.simulacoes_pagamento.inputs IS
  'valor_lote, custo_casa, entrada, parcela_mensal, parcela_unica, prazo_desembolso, dados do cliente, etc.';
COMMENT ON COLUMN public.simulacoes_pagamento.resultado IS
  'Cascata VTP, saldo a financiar, 1ª/última SAC, juros_obra, etc.';
COMMENT ON COLUMN public.simulacoes_pagamento.alertas IS
  'Array de {codigo, mensagem, severidade}. Nunca bloqueia salvar.';
COMMENT ON COLUMN public.simulacoes_pagamento.status IS
  'rascunho | salva | pdf_gerado. Lead do QR sem PDF = salva.';

-- ─── updated_at ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.loteamento_simulador_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_loteamento_simulador_templates_updated
  ON public.loteamento_simulador_templates;
CREATE TRIGGER tr_loteamento_simulador_templates_updated
  BEFORE UPDATE ON public.loteamento_simulador_templates
  FOR EACH ROW
  EXECUTE PROCEDURE public.loteamento_simulador_set_updated_at();

DROP TRIGGER IF EXISTS tr_simulacoes_pagamento_updated
  ON public.simulacoes_pagamento;
CREATE TRIGGER tr_simulacoes_pagamento_updated
  BEFORE UPDATE ON public.simulacoes_pagamento
  FOR EACH ROW
  EXECUTE PROCEDURE public.loteamento_simulador_set_updated_at();

-- ─── RLS templates ───────────────────────────────────────────────────────────
-- Sem GRANT para anon: a rota pública /simulador/[token] lê/grava via service role
-- (createAdminClient), no mesmo padrão de /calculadora/[token]/leitura.
ALTER TABLE public.loteamento_simulador_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loteamento_simulador_templates_select_staff"
  ON public.loteamento_simulador_templates;
CREATE POLICY "loteamento_simulador_templates_select_staff"
  ON public.loteamento_simulador_templates
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

DROP POLICY IF EXISTS "loteamento_simulador_templates_write_staff"
  ON public.loteamento_simulador_templates;
CREATE POLICY "loteamento_simulador_templates_write_staff"
  ON public.loteamento_simulador_templates
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loteamento_simulador_templates
  TO authenticated, service_role;

-- ─── RLS simulações ──────────────────────────────────────────────────────────
ALTER TABLE public.simulacoes_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulacoes_pagamento_select_staff"
  ON public.simulacoes_pagamento;
CREATE POLICY "simulacoes_pagamento_select_staff"
  ON public.simulacoes_pagamento
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

DROP POLICY IF EXISTS "simulacoes_pagamento_write_staff"
  ON public.simulacoes_pagamento;
CREATE POLICY "simulacoes_pagamento_write_staff"
  ON public.simulacoes_pagamento
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacoes_pagamento
  TO authenticated, service_role;

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('544', 'loteamento_simulador')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('544')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
