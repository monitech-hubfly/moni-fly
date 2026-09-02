-- 463: Cadastro de Fornecedores em Rede Casa Moní (mestre + vínculo N:N com cards).
-- Acesso: SELECT staff autenticado; INSERT/UPDATE admin/team/consultor/supervisor.
-- Sem acesso de franqueado/Frank.

CREATE TABLE IF NOT EXISTS public.fornecedores_rede (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                   text,
  categoria              text,
  produtos               text,
  regiao_atuacao         text,
  prazo_entrega          text,
  frete_proprio          boolean,
  frete_tipo             text,
  fatura_para_spe        boolean,
  contato_responsavel    text,
  dados_empresa_anexo_url text,
  volume_suportado       text,
  margem_loja_moni       numeric,
  forma_pagamento        text,
  prazo_garantia         text,
  politica_troca         text,
  ncm                    text,
  anexo_proposta_url     text,
  nps                    numeric,
  status                 text NOT NULL DEFAULT 'em_avaliacao',
  motivo_perda           text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fornecedores_rede_status_check
    CHECK (status IS NULL OR status IN ('ativo', 'inativo', 'em_avaliacao')),
  CONSTRAINT fornecedores_rede_frete_tipo_check
    CHECK (frete_tipo IS NULL OR frete_tipo IN ('fixo', 'variavel'))
);

CREATE TABLE IF NOT EXISTS public.fornecedor_card_vinculos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id        uuid NOT NULL REFERENCES public.fornecedores_rede(id) ON DELETE CASCADE,
  card_id              uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  nps_cotacao          numeric,
  status_cotacao       text,
  motivo_perda_cotacao text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fornecedor_card_vinculos_unique UNIQUE (fornecedor_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_rede_nome
  ON public.fornecedores_rede (nome);

CREATE INDEX IF NOT EXISTS idx_fornecedores_rede_categoria
  ON public.fornecedores_rede (categoria);

CREATE INDEX IF NOT EXISTS idx_fornecedores_rede_regiao
  ON public.fornecedores_rede (regiao_atuacao);

CREATE INDEX IF NOT EXISTS idx_fornecedor_card_vinculos_card
  ON public.fornecedor_card_vinculos (card_id);

CREATE INDEX IF NOT EXISTS idx_fornecedor_card_vinculos_fornecedor
  ON public.fornecedor_card_vinculos (fornecedor_id);

ALTER TABLE public.fornecedores_rede ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedor_card_vinculos ENABLE ROW LEVEL SECURITY;

-- SELECT: autenticados com role staff (não franqueado/frank)
DROP POLICY IF EXISTS "fornecedores_rede_select_staff" ON public.fornecedores_rede;
CREATE POLICY "fornecedores_rede_select_staff"
  ON public.fornecedores_rede
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "fornecedores_rede_insert_staff" ON public.fornecedores_rede;
CREATE POLICY "fornecedores_rede_insert_staff"
  ON public.fornecedores_rede
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "fornecedores_rede_update_staff" ON public.fornecedores_rede;
CREATE POLICY "fornecedores_rede_update_staff"
  ON public.fornecedores_rede
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "fornecedor_card_vinculos_select_staff" ON public.fornecedor_card_vinculos;
CREATE POLICY "fornecedor_card_vinculos_select_staff"
  ON public.fornecedor_card_vinculos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "fornecedor_card_vinculos_insert_staff" ON public.fornecedor_card_vinculos;
CREATE POLICY "fornecedor_card_vinculos_insert_staff"
  ON public.fornecedor_card_vinculos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "fornecedor_card_vinculos_update_staff" ON public.fornecedor_card_vinculos;
CREATE POLICY "fornecedor_card_vinculos_update_staff"
  ON public.fornecedor_card_vinculos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "fornecedor_card_vinculos_delete_staff" ON public.fornecedor_card_vinculos;
CREATE POLICY "fornecedor_card_vinculos_delete_staff"
  ON public.fornecedor_card_vinculos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.fornecedores_rede TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedor_card_vinculos TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('463', 'fornecedores_rede')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
