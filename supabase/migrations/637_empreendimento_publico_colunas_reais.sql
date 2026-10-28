-- 637: A função pública quebrava com "column lst.perc_entrada_minima does not exist"
-- e devolvia "Empreendimento não encontrado" mesmo com slug e planilha preenchidos.
-- Usa as colunas reais de loteamento_simulador_templates. Gate continua sendo a planilha.
-- Idempotente.

ALTER TABLE public.imob_card_empreendimentos
  ADD COLUMN IF NOT EXISTS valor_acoplamento numeric(14,2);

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
    AND icm.planilha_lotes_path IS NOT NULL
    AND btrim(icm.planilha_lotes_path) <> ''
  LIMIT 1;

  IF v_card_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'card_id',               v_card_id,
    'slug',                  icm.page_slug,
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
  FROM public.imob_card_modelo icm
  JOIN public.kanban_cards kc ON kc.id = icm.card_id
  WHERE icm.card_id = v_card_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.empreendimento_publico_carregar(text) TO anon, authenticated;

COMMENT ON FUNCTION public.empreendimento_publico_carregar IS
  'Jornada pública por slug. Exige planilha de lotes. Template usa as colunas reais do simulador.';

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('637', 'empreendimento_publico_colunas_reais')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('637')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
