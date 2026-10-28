-- 575: Taxa de gestão percentual|fixo + fatia da plataforma na entrada.
-- Idempotente. Aplicar só em DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Não altera PROD.

ALTER TABLE public.loteamento_simulador_templates
  ADD COLUMN IF NOT EXISTS tipo_taxa_gestao text NOT NULL DEFAULT 'percentual',
  ADD COLUMN IF NOT EXISTS pct_plataforma_entrada numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE public.loteamento_simulador_templates
    DROP CONSTRAINT IF EXISTS loteamento_simulador_templates_tipo_taxa_gestao_check;
  ALTER TABLE public.loteamento_simulador_templates
    ADD CONSTRAINT loteamento_simulador_templates_tipo_taxa_gestao_check
    CHECK (tipo_taxa_gestao IN ('percentual', 'fixo'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.loteamento_simulador_templates.tipo_taxa_gestao IS
  'percentual: pct_taxa_gestao é fração sobre custo da obra (0.07=7%). fixo: pct_taxa_gestao é valor absoluto em R$.';
COMMENT ON COLUMN public.loteamento_simulador_templates.pct_plataforma_entrada IS
  'Fração da taxa de plataforma cobrada na entrada (0.10=10%). O restante vai aos 3 primeiros meses de obra. 0 = diluir no prazo todo.';

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
        'itbi_percentual',                 lst.pct_itbi,
        'pct_taxa_plataforma',             lst.pct_taxa_plataforma,
        'pct_taxa_gestao',                 lst.pct_taxa_gestao,
        'tipo_taxa_gestao',                lst.tipo_taxa_gestao,
        'pct_plataforma_entrada',          lst.pct_plataforma_entrada,
        'pct_impostos',                    lst.pct_impostos,
        'pct_comissao_corretor',           lst.pct_comissao_corretor,
        'pct_lucro_loteadora',             lst.pct_lucro_loteadora,
        'pct_lucro_moni',                  lst.pct_lucro_moni,
        'pct_lucro_franqueado',            lst.pct_lucro_franqueado
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
  VALUES ('575', 'template_gestao_fixo_plataforma_entrada')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('575')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
