-- 634: Fix page_ativa retroativo + remover dependência de page_ativa na função pública.
-- Corrige cards com page_slug e planilha_lotes_path preenchidos mas page_ativa = false.
-- Atualiza empreendimento_publico_carregar para usar planilha_lotes_path como gate real.
-- Idempotente.

-- 1. Backfill: ativar registros que têm slug e planilha mas page_ativa = false
UPDATE public.imob_card_modelo
SET page_ativa = true
WHERE page_ativa = false
  AND page_slug IS NOT NULL
  AND page_slug <> ''
  AND planilha_lotes_path IS NOT NULL
  AND planilha_lotes_path <> '';

-- 2. Atualizar função para não depender de page_ativa (gate real = planilha_lotes_path)
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
  WHERE icm.page_slug = p_slug
    AND icm.planilha_lotes_path IS NOT NULL
    AND icm.planilha_lotes_path <> ''
  LIMIT 1;

  IF v_card_id IS NULL THEN RETURN NULL; END IF;

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
  'Carrega dados públicos do empreendimento por slug. Gate real: planilha_lotes_path preenchido. page_ativa é calculado automaticamente no save.';

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('634', 'empreendimento_page_ativa_backfill')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('634')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
