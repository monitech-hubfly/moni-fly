-- 549: Lotes do template do Simulador + campos da oferta pública do corretor.
-- Idempotente. Aplicar só em DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Não altera PROD.
-- FK aponta para loteamento_simulador_templates (não existe tabela "templates").

CREATE TABLE IF NOT EXISTS public.lotes_template (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID NOT NULL REFERENCES public.loteamento_simulador_templates(id) ON DELETE CASCADE,
  codigo       TEXT NOT NULL,
  valor        NUMERIC(12, 2) NOT NULL,
  disponivel   BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lotes_template_template_id
  ON public.lotes_template (template_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lotes_template_codigo
  ON public.lotes_template (template_id, codigo);

COMMENT ON TABLE public.lotes_template IS
  'Lotes disponíveis para seleção na página pública do corretor (/simulador/[token]).';
COMMENT ON COLUMN public.lotes_template.codigo IS
  'Código exibido no dropdown (ex.: LOT-001).';
COMMENT ON COLUMN public.lotes_template.valor IS
  'Valor do lote à vista, em reais.';

DROP TRIGGER IF EXISTS tr_lotes_template_updated ON public.lotes_template;
CREATE TRIGGER tr_lotes_template_updated
  BEFORE UPDATE ON public.lotes_template
  FOR EACH ROW
  EXECUTE PROCEDURE public.loteamento_simulador_set_updated_at();

ALTER TABLE public.lotes_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lotes visíveis publicamente" ON public.lotes_template;
CREATE POLICY "Lotes visíveis publicamente"
  ON public.lotes_template
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Lotes gerenciados por autenticados" ON public.lotes_template;
CREATE POLICY "Lotes gerenciados por autenticados"
  ON public.lotes_template
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

GRANT SELECT ON public.lotes_template TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.lotes_template TO authenticated, service_role;

-- Campos extras em simulacoes_pagamento (oferta do corretor). Só ADD; não altera colunas existentes.
ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS cliente_telefone TEXT;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS cliente_email TEXT;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS lote_id UUID REFERENCES public.lotes_template(id) ON DELETE SET NULL;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS lote_valor_manual NUMERIC(12, 2);

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS personalizada BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS entrada_confirmada NUMERIC;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS parcela_mensal_confirmada NUMERIC;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS parcela_unica_confirmada NUMERIC;

COMMENT ON COLUMN public.simulacoes_pagamento.cliente_nome IS
  'Nome do cliente na oferta pública do corretor.';
COMMENT ON COLUMN public.simulacoes_pagamento.cliente_telefone IS
  'Telefone do cliente na oferta pública do corretor.';
COMMENT ON COLUMN public.simulacoes_pagamento.cliente_email IS
  'E-mail do cliente na oferta pública do corretor.';
COMMENT ON COLUMN public.simulacoes_pagamento.lote_id IS
  'Lote escolhido em lotes_template; null quando o valor foi digitado manualmente.';
COMMENT ON COLUMN public.simulacoes_pagamento.lote_valor_manual IS
  'Valor do lote digitado quando o lote já havia sido adquirido.';
COMMENT ON COLUMN public.simulacoes_pagamento.personalizada IS
  'true = salva pelo bloco Personalizar; false = valores sugeridos do resumo.';

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('549', 'lotes_template_simulador')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('549')
    ON CONFLICT (version) DO NOTHING;
END $$;

-- Leitura/gravação da página pública via RPC (anon), sem expor o template inteiro no REST.
CREATE OR REPLACE FUNCTION public.simulador_publico_carregar(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tpl jsonb;
  v_lotes jsonb;
  v_token text := btrim(COALESCE(p_token, ''));
BEGIN
  IF v_token = '' THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(t) INTO v_tpl
  FROM public.loteamento_simulador_templates t
  WHERE t.link_token = v_token
     OR (
       v_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       AND t.id = v_token::uuid
     )
  LIMIT 1;

  IF v_tpl IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', l.id, 'codigo', l.codigo, 'valor', l.valor)
      ORDER BY l.codigo
    ),
    '[]'::jsonb
  )
  INTO v_lotes
  FROM public.lotes_template l
  WHERE l.template_id = (v_tpl->>'id')::uuid
    AND l.disponivel IS TRUE;

  RETURN jsonb_build_object('template', v_tpl, 'lotes', v_lotes);
END;
$$;

CREATE OR REPLACE FUNCTION public.simulador_publico_salvar(p_token text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tpl public.loteamento_simulador_templates%ROWTYPE;
  v_lote public.lotes_template%ROWTYPE;
  v_token text := btrim(COALESCE(p_token, ''));
  v_lote_id uuid;
  v_valor_lote numeric;
  v_nome text;
  v_id uuid;
BEGIN
  IF v_token = '' THEN
    RAISE EXCEPTION 'Link do simulador inválido.';
  END IF;
  IF p_payload IS NULL THEN
    RAISE EXCEPTION 'Payload inválido.';
  END IF;

  SELECT * INTO v_tpl
  FROM public.loteamento_simulador_templates
  WHERE link_token = v_token
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template não encontrado para este link.';
  END IF;

  v_lote_id := NULLIF(btrim(COALESCE(p_payload->>'lote_id', '')), '')::uuid;
  IF v_lote_id IS NOT NULL THEN
    SELECT * INTO v_lote
    FROM public.lotes_template
    WHERE id = v_lote_id AND template_id = v_tpl.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Lote inválido para este loteamento.';
    END IF;
    v_valor_lote := v_lote.valor;
    v_nome := concat(btrim(COALESCE(p_payload->>'cliente_nome', '')), ' — ', v_lote.codigo);
  ELSE
    v_valor_lote := COALESCE((p_payload->>'valor_lote')::numeric, 0);
    IF v_valor_lote <= 0 THEN
      RAISE EXCEPTION 'Informe o valor do lote.';
    END IF;
    v_nome := btrim(COALESCE(p_payload->>'cliente_nome', ''));
  END IF;

  IF v_nome = '' THEN
    RAISE EXCEPTION 'Informe o nome completo do cliente.';
  END IF;

  INSERT INTO public.simulacoes_pagamento (
    template_id,
    kanban_card_id,
    rede_loteador_id,
    created_by,
    nome,
    condicao_lote,
    renda_informada_cliente,
    valor_lote,
    valor_casa,
    valor_customizacao,
    valor_ja_pago,
    prazo_meses,
    parcela_mensal,
    renda_cliente,
    prazo_financiamento_anos,
    taxa_financiamento_anual,
    cliente_nome,
    cliente_telefone,
    cliente_email,
    lote_id,
    lote_valor_manual,
    personalizada,
    entrada_confirmada,
    parcela_mensal_confirmada,
    parcela_unica_confirmada,
    inputs,
    resultado,
    alertas,
    status
  ) VALUES (
    v_tpl.id,
    v_tpl.kanban_card_id,
    v_tpl.rede_loteador_id,
    NULL,
    v_nome,
    COALESCE(NULLIF(p_payload->>'condicao_lote', ''), 'nao_pago'),
    NULLIF(p_payload->>'renda_cliente', '')::numeric,
    v_valor_lote,
    COALESCE((p_payload->>'valor_casa')::numeric, 0),
    COALESCE((p_payload->>'valor_customizacao')::numeric, 0),
    COALESCE((p_payload->>'valor_ja_pago')::numeric, 0),
    COALESCE((p_payload->>'prazo_meses')::integer, 12),
    COALESCE((p_payload->>'parcela_mensal')::numeric, 0),
    NULLIF(p_payload->>'renda_cliente', '')::numeric,
    NULLIF(p_payload->>'prazo_financiamento_anos', '')::integer,
    NULLIF(p_payload->>'taxa_financiamento_anual', '')::numeric,
    btrim(COALESCE(p_payload->>'cliente_nome', '')),
    NULLIF(btrim(COALESCE(p_payload->>'cliente_telefone', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'cliente_email', '')), ''),
    v_lote_id,
    CASE WHEN v_lote_id IS NULL THEN v_valor_lote ELSE NULL END,
    COALESCE((p_payload->>'personalizada')::boolean, false),
    NULLIF(p_payload->>'entrada_confirmada', '')::numeric,
    NULLIF(p_payload->>'parcela_mensal_confirmada', '')::numeric,
    NULLIF(p_payload->>'parcela_unica_confirmada', '')::numeric,
    COALESCE(p_payload->'inputs', '{}'::jsonb),
    COALESCE(p_payload->'resultado', '{}'::jsonb),
    COALESCE(p_payload->'alertas', '[]'::jsonb),
    'rascunho'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'nome', v_nome);
END;
$$;

REVOKE ALL ON FUNCTION public.simulador_publico_carregar(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.simulador_publico_salvar(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.simulador_publico_carregar(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.simulador_publico_salvar(text, jsonb) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
