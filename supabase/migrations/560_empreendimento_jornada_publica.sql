-- 560: Jornada Pública do Cliente — /empreendimento/[slug]
-- Adiciona: slug de URL, itens de customização (kit_moní e gadgets), sessão do cliente.
-- O modelo de casa é definido pela oferta (Helena configura no card).
-- O valor de acoplamento vem da planilha de lotes (por lote).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Branch: funcionalidade-fernanda
-- Não aplicar em PROD sem revisão.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. URL slug da página pública no empreendimento
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.imob_card_modelo
  ADD COLUMN IF NOT EXISTS page_slug        text,
  ADD COLUMN IF NOT EXISTS page_ativa       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS page_titulo      text,
  ADD COLUMN IF NOT EXISTS page_descricao   text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_imob_card_modelo_page_slug
  ON public.imob_card_modelo (page_slug)
  WHERE page_slug IS NOT NULL;

COMMENT ON COLUMN public.imob_card_modelo.page_slug IS
  'Slug da URL pública do empreendimento, ex: jardins-da-serra → /empreendimento/jardins-da-serra';
COMMENT ON COLUMN public.imob_card_modelo.page_ativa IS
  'Se false, a página pública retorna 404 mesmo com slug válido.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Itens de customização opcionais: kit Moní e gadgets
--    (Acoplamento NÃO está aqui — valor vem da planilha de lotes, por lote)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.empreendimento_itens_customizacao (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id         uuid        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  categoria       text        NOT NULL CHECK (categoria IN ('kit_moni','gadget')),
  nome            text        NOT NULL,
  descricao       text,
  valor           numeric(14,2) NOT NULL DEFAULT 0,
  ordem           integer     NOT NULL DEFAULT 0,
  ativo           boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empreendimento_itens_card
  ON public.empreendimento_itens_customizacao (card_id, categoria, ordem);

COMMENT ON TABLE public.empreendimento_itens_customizacao IS
  'Itens opcionais de customização: kit Moní e gadgets. Acoplamento vem da planilha de lotes.';

ALTER TABLE public.empreendimento_itens_customizacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empreendimento_itens_select_all" ON public.empreendimento_itens_customizacao;
CREATE POLICY "empreendimento_itens_select_all"
  ON public.empreendimento_itens_customizacao FOR SELECT USING (true);

DROP POLICY IF EXISTS "empreendimento_itens_write_team" ON public.empreendimento_itens_customizacao;
CREATE POLICY "empreendimento_itens_write_team"
  ON public.empreendimento_itens_customizacao FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','team')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','team')));

GRANT SELECT ON public.empreendimento_itens_customizacao TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empreendimento_itens_customizacao TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Sessão do cliente (progresso na jornada pública)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.jornada_cliente_sessao (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token         text        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  card_id               uuid        REFERENCES public.kanban_cards(id) ON DELETE SET NULL,

  -- Passo 1
  nome_cliente          text,
  telefone_cliente      text,

  -- Passo 2
  lote_codigo           text,
  lote_valor            numeric(14,2),

  -- Passo 3 — oferta selecionada (a oferta define o modelo de casa)
  empreendimento_id     uuid        REFERENCES public.imob_card_empreendimentos(id) ON DELETE SET NULL,

  -- Passo 4 — customização
  itens_selecionados    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  valor_acoplamento     numeric(14,2),   -- vem da planilha de lotes
  valor_kit             numeric(14,2),
  valor_gadgets         numeric(14,2),

  -- Valores consolidados (entram no motor de cálculo — Passo 5)
  valor_lote            numeric(14,2),
  valor_casa            numeric(14,2),
  valor_customizacao    numeric(14,2),

  -- Passo 5 — simulação
  simulacao_id          uuid        REFERENCES public.simulacoes_pagamento(id) ON DELETE SET NULL,

  -- Controle
  etapa_atual           integer     NOT NULL DEFAULT 1,
  concluida_em          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jornada_sessao_token
  ON public.jornada_cliente_sessao (session_token);
CREATE INDEX IF NOT EXISTS idx_jornada_sessao_card
  ON public.jornada_cliente_sessao (card_id);

COMMENT ON TABLE public.jornada_cliente_sessao IS
  'Progresso de cada cliente na jornada pública /empreendimento/[slug]. session_token fica na URL para retomada.';

ALTER TABLE public.jornada_cliente_sessao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jornada_sessao_all_anon" ON public.jornada_cliente_sessao;
CREATE POLICY "jornada_sessao_all_anon"
  ON public.jornada_cliente_sessao FOR ALL
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.jornada_cliente_sessao TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPCs públicas (SECURITY DEFINER — chave anon)
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. Carregar empreendimento por slug (inclui config do template para o motor de cálculo)
CREATE OR REPLACE FUNCTION public.empreendimento_publico_carregar(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_id uuid;
  v_result  jsonb;
BEGIN
  SELECT icm.card_id INTO v_card_id
  FROM public.imob_card_modelo icm
  WHERE icm.page_slug = p_slug AND icm.page_ativa = true
  LIMIT 1;

  IF v_card_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'card_id',               v_card_id,
    'slug',                  icm.page_slug,
    'titulo',                COALESCE(icm.page_titulo, kc.title),
    'descricao',             icm.page_descricao,
    'status_imovel',         icm.status_imovel,
    'imagem_principal_path', icm.imagem_principal_path,
    'planilha_lotes_path',   icm.planilha_lotes_path,
    'planilha_lotes_nome',   icm.planilha_lotes_nome,

    -- Config do template (para o motor de cálculo no Passo 5)
    'template', (
      SELECT jsonb_build_object(
        'id',                              lst.id,
        'link_token',                      lst.link_token,
        'prazo_obra_meses',                lst.prazo_obra_meses,
        'valor_lote_padrao',               lst.valor_lote_padrao,
        'taxa_juros_financiamento_anual',  lst.taxa_juros_financiamento_anual,
        'taxa_juros_parcelado_mes',        lst.taxa_juros_parcelado_mes,
        'perc_entrada_minima',             lst.perc_entrada_minima,
        'perc_entrada_sugerida',           lst.perc_entrada_sugerida,
        'perc_parcela_mensal',             lst.perc_parcela_mensal,
        'perc_cp',                         lst.perc_cp,
        'num_meses_cp',                    lst.num_meses_cp,
        'itbi_percentual',                 lst.itbi_percentual
      )
      FROM public.loteamento_simulador_templates lst
      WHERE lst.kanban_card_id = v_card_id
      LIMIT 1
    ),

    -- Itens de customização ativos (kit_moni e gadgets)
    'itens_customizacao', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',        ic.id,
          'categoria', ic.categoria,
          'nome',      ic.nome,
          'descricao', ic.descricao,
          'valor',     ic.valor,
          'ordem',     ic.ordem
        )
        ORDER BY ic.categoria, ic.ordem
      ), '[]'::jsonb)
      FROM public.empreendimento_itens_customizacao ic
      WHERE ic.card_id = v_card_id AND ic.ativo = true
    ),

    -- Ofertas do empreendimento (a oferta define o modelo de casa)
    'ofertas', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',             emp.id,
          'nome',           emp.nome,
          'ordem',          emp.ordem,
          'valor_avista',   emp.valor_avista,
          'titulo_oferta',  emp.titulo_oferta,
          'produto_modelo', emp.produto_modelo,
          'descricao',      emp.descricao
        )
        ORDER BY emp.ordem
      ), '[]'::jsonb)
      FROM public.imob_card_empreendimentos emp
      WHERE emp.card_id = v_card_id
    )
  ) INTO v_result
  FROM public.imob_card_modelo icm
  JOIN public.kanban_cards kc ON kc.id = icm.card_id
  WHERE icm.card_id = v_card_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.empreendimento_publico_carregar(text) TO anon, authenticated;
COMMENT ON FUNCTION public.empreendimento_publico_carregar IS
  'Carrega dados públicos de um empreendimento pelo slug. SECURITY DEFINER — funciona sem login.';

-- 4b. Criar ou atualizar sessão do cliente
CREATE OR REPLACE FUNCTION public.jornada_sessao_salvar(
  p_token   text,
  p_card_id uuid,
  p_etapa   integer,
  p_dados   jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_row   public.jornada_cliente_sessao;
BEGIN
  IF p_token IS NOT NULL AND p_token <> '' THEN
    SELECT * INTO v_row
    FROM public.jornada_cliente_sessao
    WHERE session_token = p_token AND card_id = p_card_id
    LIMIT 1;
  END IF;

  IF v_row.id IS NULL THEN
    v_token := COALESCE(NULLIF(p_token,''), gen_random_uuid()::text);
    INSERT INTO public.jornada_cliente_sessao (
      session_token, card_id, etapa_atual,
      nome_cliente, telefone_cliente,
      lote_codigo, lote_valor,
      empreendimento_id,
      itens_selecionados,
      valor_acoplamento, valor_kit, valor_gadgets,
      valor_lote, valor_casa, valor_customizacao,
      simulacao_id, concluida_em
    ) VALUES (
      v_token, p_card_id, p_etapa,
      p_dados->>'nome_cliente',
      p_dados->>'telefone_cliente',
      p_dados->>'lote_codigo',
      (p_dados->>'lote_valor')::numeric,
      (p_dados->>'empreendimento_id')::uuid,
      COALESCE(p_dados->'itens_selecionados', '[]'),
      (p_dados->>'valor_acoplamento')::numeric,
      (p_dados->>'valor_kit')::numeric,
      (p_dados->>'valor_gadgets')::numeric,
      (p_dados->>'valor_lote')::numeric,
      (p_dados->>'valor_casa')::numeric,
      (p_dados->>'valor_customizacao')::numeric,
      (p_dados->>'simulacao_id')::uuid,
      CASE WHEN (p_dados->>'concluida') = 'true' THEN now() ELSE NULL END
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.jornada_cliente_sessao SET
      etapa_atual        = GREATEST(etapa_atual, p_etapa),
      updated_at         = now(),
      nome_cliente       = COALESCE(p_dados->>'nome_cliente',      nome_cliente),
      telefone_cliente   = COALESCE(p_dados->>'telefone_cliente',  telefone_cliente),
      lote_codigo        = COALESCE(p_dados->>'lote_codigo',       lote_codigo),
      lote_valor         = COALESCE((p_dados->>'lote_valor')::numeric, lote_valor),
      empreendimento_id  = COALESCE((p_dados->>'empreendimento_id')::uuid, empreendimento_id),
      itens_selecionados = COALESCE(p_dados->'itens_selecionados', itens_selecionados),
      valor_acoplamento  = COALESCE((p_dados->>'valor_acoplamento')::numeric, valor_acoplamento),
      valor_kit          = COALESCE((p_dados->>'valor_kit')::numeric, valor_kit),
      valor_gadgets      = COALESCE((p_dados->>'valor_gadgets')::numeric, valor_gadgets),
      valor_lote         = COALESCE((p_dados->>'valor_lote')::numeric, valor_lote),
      valor_casa         = COALESCE((p_dados->>'valor_casa')::numeric, valor_casa),
      valor_customizacao = COALESCE((p_dados->>'valor_customizacao')::numeric, valor_customizacao),
      simulacao_id       = COALESCE((p_dados->>'simulacao_id')::uuid, simulacao_id),
      concluida_em       = CASE
                             WHEN (p_dados->>'concluida') = 'true' AND concluida_em IS NULL THEN now()
                             ELSE concluida_em
                           END
    WHERE session_token = p_token AND card_id = p_card_id
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'session_token', v_row.session_token,
    'etapa_atual',   v_row.etapa_atual,
    'concluida',     v_row.concluida_em IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.jornada_sessao_salvar(text, uuid, integer, jsonb) TO anon, authenticated;
COMMENT ON FUNCTION public.jornada_sessao_salvar IS
  'Cria ou atualiza sessão do cliente na jornada pública. SECURITY DEFINER — funciona sem login.';

-- 4c. Carregar sessão por token (retomada da jornada)
CREATE OR REPLACE FUNCTION public.jornada_sessao_carregar(p_token text, p_card_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.jornada_cliente_sessao;
BEGIN
  SELECT * INTO v_row
  FROM public.jornada_cliente_sessao
  WHERE session_token = p_token AND card_id = p_card_id
  LIMIT 1;

  IF v_row.id IS NULL THEN RETURN NULL; END IF;

  RETURN to_jsonb(v_row) - ARRAY['id'];
END;
$$;

GRANT EXECUTE ON FUNCTION public.jornada_sessao_carregar(text, uuid) TO anon, authenticated;
COMMENT ON FUNCTION public.jornada_sessao_carregar IS
  'Carrega sessão do cliente por token. Usada para retomar a jornada onde parou.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Registro da migração
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('560', 'empreendimento_jornada_publica')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('560')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
