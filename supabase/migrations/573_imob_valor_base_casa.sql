-- 573: Custo de construção da casa (antes do markup) na oferta IMOB.
-- valor_avista continua sendo o preço final (VTE à vista) mostrado no step 3.
-- A jornada usa valor_base_casa como input do engine para evitar double-markup.
-- Idempotente. Aplicar só em DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Não altera PROD.

ALTER TABLE public.imob_card_empreendimentos
  ADD COLUMN IF NOT EXISTS valor_base_casa numeric(15,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.imob_card_empreendimentos.valor_base_casa IS
  'Custo de construção da casa (input "Valor da casa" da Helenna), antes do markup. A jornada usa este valor no engine; valor_avista é o preço final ao cliente.';

CREATE OR REPLACE FUNCTION public.empreendimento_publico_carregar(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug    text;
  v_card_id uuid;
  v_result  jsonb;
BEGIN
  v_slug := lower(btrim(COALESCE(p_slug, '')));
  IF v_slug = '' THEN
    RETURN NULL;
  END IF;

  SELECT icm.card_id INTO v_card_id
  FROM public.imob_card_modelo icm
  WHERE icm.page_slug IS NOT NULL
    AND lower(btrim(icm.page_slug)) = v_slug
  LIMIT 1;

  IF v_card_id IS NULL THEN
    SELECT ie.card_id INTO v_card_id
    FROM public.imob_empreendimentos ie
    WHERE ie.slug IS NOT NULL
      AND lower(btrim(ie.slug)) = v_slug
      AND ie.card_id IS NOT NULL
    LIMIT 1;
  END IF;

  IF v_card_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'card_id',               v_card_id,
    'slug',                  COALESCE(icm.page_slug, v_slug),
    'titulo',                COALESCE(icm.page_titulo, kc.titulo),
    'descricao',             icm.page_descricao,
    'status_imovel',         icm.status_imovel,
    'imagem_principal_path', icm.imagem_principal_path,
    'planilha_lotes_path',   icm.planilha_lotes_path,
    'planilha_lotes_nome',   icm.planilha_lotes_nome,

    'template', (
      SELECT jsonb_build_object(
        'id',                              lst.id,
        'link_token',                      lst.link_token,
        'prazo_obra_meses',                lst.prazo_obra_meses,
        'valor_lote_padrao',               lst.valor_lote_padrao,
        'taxa_juros_financiamento_anual',  lst.taxa_juros_financiamento_anual,
        'taxa_juros_parcelado_mes',        lst.taxa_juros_parcelado_mes,
        'perc_entrada_minima',             (lst.entrada_minima_loteadora->>'valor')::numeric,
        'perc_entrada_sugerida',           (lst.premissa_entrada_lote_parcial->>'valor')::numeric,
        'perc_parcela_mensal',             (lst.premissa_entrada_lote_nao_pago->>'valor')::numeric,
        'perc_cp',                         lst.taxa_juros_credito_ponte,
        'num_meses_cp',                    lst.prazo_desembolso_sugerido,
        'itbi_percentual',                 lst.pct_itbi
      )
      FROM public.loteamento_simulador_templates lst
      WHERE lst.kanban_card_id = v_card_id
      LIMIT 1
    ),

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

    'ofertas', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',                emp.id,
          'nome',              emp.nome,
          'ordem',             emp.ordem,
          'valor_avista',      emp.valor_avista,
          'valor_base_casa',   emp.valor_base_casa,
          'valor_acoplamento', emp.valor_acoplamento,
          'titulo_oferta',     emp.titulo_oferta,
          'produto_modelo',    emp.produto_modelo,
          'descricao',         emp.descricao
        )
        ORDER BY emp.ordem
      ), '[]'::jsonb)
      FROM public.imob_card_empreendimentos emp
      WHERE emp.card_id = v_card_id
    )
  ) INTO v_result
  FROM public.kanban_cards kc
  LEFT JOIN public.imob_card_modelo icm ON icm.card_id = kc.id
  WHERE kc.id = v_card_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.empreendimento_publico_carregar(text) TO anon, authenticated;

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('573', 'imob_valor_base_casa')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('573')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
