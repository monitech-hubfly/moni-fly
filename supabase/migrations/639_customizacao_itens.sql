-- 639: Banco de itens de customização da casa (global, sem categoria) + RPC pública da jornada.
-- Itens identificados pelo nome (coluna Item da planilha). Preço por modelo em valores_por_modelo,
-- com chaves = nomes oficiais do Hub Fly (IMOB_PRODUTOS_MODELO, com ™). Ausente = valor_padrao.
-- Não altera empreendimento_itens_customizacao (fica preservada, sem uso no step 4).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabela
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customizacao_itens (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item                text        NOT NULL,
  descricao           text,
  valor_padrao        numeric(14,2),
  valores_por_modelo  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ativo               boolean     NOT NULL DEFAULT true,
  ordem               integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customizacao_itens_item_key
  ON public.customizacao_itens (item);

CREATE INDEX IF NOT EXISTS idx_customizacao_itens_ativo_ordem
  ON public.customizacao_itens (ativo, ordem);

COMMENT ON TABLE public.customizacao_itens IS
  'Itens de customização da casa exibidos no step 4 da jornada pública. Carga via planilha Itens_customizacao_casas.xlsx.';
COMMENT ON COLUMN public.customizacao_itens.item IS
  'Nome do item visto pelo cliente; identificador único (a planilha não tem código).';
COMMENT ON COLUMN public.customizacao_itens.valor_padrao IS
  'Preço para modelos sem valor próprio. NULL = item só disponível nos modelos de valores_por_modelo.';
COMMENT ON COLUMN public.customizacao_itens.valores_por_modelo IS
  'Preço por modelo: {"Moní Gal™": 28000}. Chave = nome oficial do modelo no Hub Fly.';
COMMENT ON COLUMN public.customizacao_itens.ordem IS
  'Ordem de exibição (ordem das linhas da planilha).';

CREATE OR REPLACE FUNCTION public.customizacao_itens_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_customizacao_itens_updated ON public.customizacao_itens;
CREATE TRIGGER tr_customizacao_itens_updated
  BEFORE UPDATE ON public.customizacao_itens
  FOR EACH ROW EXECUTE FUNCTION public.customizacao_itens_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS — só usuários internos (admin/team) leem e escrevem direto
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.customizacao_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customizacao_itens_select_staff" ON public.customizacao_itens;
CREATE POLICY "customizacao_itens_select_staff"
  ON public.customizacao_itens FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','team')));

DROP POLICY IF EXISTS "customizacao_itens_write_staff" ON public.customizacao_itens;
CREATE POLICY "customizacao_itens_write_staff"
  ON public.customizacao_itens FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','team')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','team')));

REVOKE ALL ON public.customizacao_itens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customizacao_itens TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC pública da jornada (chave anon) — só itens ativos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.jornada_customizacao_itens()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',                 ci.id,
      'item',               ci.item,
      'descricao',          ci.descricao,
      'valor_padrao',       ci.valor_padrao,
      'valores_por_modelo', ci.valores_por_modelo,
      'ordem',              ci.ordem
    )
    ORDER BY ci.ordem, ci.item
  ), '[]'::jsonb)
  FROM public.customizacao_itens ci
  WHERE ci.ativo = true;
$$;

REVOKE ALL ON FUNCTION public.jornada_customizacao_itens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jornada_customizacao_itens() TO anon, authenticated;
COMMENT ON FUNCTION public.jornada_customizacao_itens IS
  'Itens de customização ativos para o step 4 da jornada pública. SECURITY DEFINER — funciona sem login.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Itens escolhidos: sessão da jornada e simulação
--    Formato: [{"id": uuid, "item": text, "valor": numeric}] (valor aplicado ao modelo)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.jornada_cliente_sessao
  ADD COLUMN IF NOT EXISTS customizacao_itens jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.jornada_cliente_sessao.customizacao_itens IS
  'Itens de customização escolhidos no step 4: [{id, item, valor}] com o valor aplicado ao modelo.';

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS customizacao_itens jsonb;

COMMENT ON COLUMN public.simulacoes_pagamento.customizacao_itens IS
  'Itens de customização escolhidos (jornada): [{id, item, valor}] com o valor aplicado ao modelo.';

-- jornada_sessao_salvar: mesma função da 635 + customizacao_itens.
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
      customizacao_itens,
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
      COALESCE(p_dados->'customizacao_itens', '[]'),
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
      customizacao_itens = COALESCE(p_dados->'customizacao_itens', customizacao_itens),
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Registro da migração
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('639', 'customizacao_itens')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('639')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
