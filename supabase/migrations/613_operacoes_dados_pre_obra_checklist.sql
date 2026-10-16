-- 613: Dados Pré Obra do Funil Pré Obra e Obra nas fases, espelhados na lateral do card.
-- Chave compartilhada preobra:<campo>. Não move cards. Idempotente.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS docs_condominio text,
  ADD COLUMN IF NOT EXISTS docs_lote text,
  ADD COLUMN IF NOT EXISTS link_projeto_legal text,
  ADD COLUMN IF NOT EXISTS data_envio_credito_obra date,
  ADD COLUMN IF NOT EXISTS data_aprovacao_credito_obra date,
  ADD COLUMN IF NOT EXISTS data_inicio_obra date,
  ADD COLUMN IF NOT EXISTS datas_comunique_se_condominio jsonb,
  ADD COLUMN IF NOT EXISTS datas_comunique_se_prefeitura jsonb;

DO $$
DECLARE
  v_kanban uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    RAISE NOTICE '613: Funil Pré Obra e Obra não encontrado — seed ignorado.';
    RETURN;
  END IF;

  CREATE TEMP TABLE _preobra (
    fase_slug text,
    campo_slug text,
    label text,
    tipo text,
    obrigatorio boolean,
    ordem int,
    config_json jsonb
  ) ON COMMIT DROP;

  INSERT INTO _preobra VALUES
    ('planialtimetrico', 'docs_condominio', 'Docs Condomínio', 'url', true, 10, '{}'::jsonb),
    ('planialtimetrico', 'docs_lote', 'Docs Lote', 'url', true, 11, '{}'::jsonb),
    ('projeto_legal', 'link_projeto_legal', 'Projeto Legal', 'url', true, 10, '{}'::jsonb),
    ('aprovacao_condominio', 'data_aprovacao_condominio', 'Data Aprovação no Condomínio', 'data', true, 10, '{}'::jsonb),
    (
      'comunique_se_condominio',
      'datas_comunique_se_condominio',
      'Data Comunique-se Condomínio',
      'texto_longo',
      true,
      10,
      '{"widget":"preobra_datas","botao":"+ Data Comunique-se Condomínio"}'::jsonb
    ),
    ('aprovacao_prefeitura', 'data_aprovacao_prefeitura', 'Data Aprovação na Prefeitura', 'data', true, 10, '{}'::jsonb),
    ('aprovacao_prefeitura', 'data_emissao_alvara', 'Data Emissão do Alvará', 'data', true, 11, '{}'::jsonb),
    ('aprovacao_prefeitura', 'data_envio_credito_obra', 'Data Envio p/ Crédito Obra', 'data', true, 12, '{}'::jsonb),
    (
      'comunique_se_prefeitura',
      'datas_comunique_se_prefeitura',
      'Data Comunique-se Prefeitura',
      'texto_longo',
      true,
      10,
      '{"widget":"preobra_datas","botao":"+ Data Comunique-se Prefeitura"}'::jsonb
    ),
    ('aguardando_credito', 'data_aprovacao_credito_obra', 'Data Aprovação Crédito Obra', 'data', true, 10, '{}'::jsonb);

  UPDATE public.kanban_fase_checklist_itens i
  SET label = n.label,
      tipo = n.tipo,
      obrigatorio = n.obrigatorio,
      config_json = n.config_json,
      chave_compartilhada = 'preobra:' || n.campo_slug,
      visivel_candidato = false,
      ordem = n.ordem
  FROM _preobra n
  JOIN public.kanban_fases kf
    ON kf.kanban_id = v_kanban
   AND kf.slug = n.fase_slug
  WHERE i.fase_id = kf.id
    AND i.campo_slug = n.campo_slug;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, chave_compartilhada
  )
  SELECT kf.id, n.ordem, n.label, n.tipo, n.obrigatorio, false, n.campo_slug, n.config_json,
         'preobra:' || n.campo_slug
  FROM _preobra n
  JOIN public.kanban_fases kf
    ON kf.kanban_id = v_kanban
   AND kf.slug = n.fase_slug
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = kf.id
      AND i.campo_slug = n.campo_slug
  );

  INSERT INTO public.kanban_card_checklist_compartilhado (card_id, chave, valor, atualizado_em)
  SELECT c.id, v.chave, to_jsonb(v.valor), NOW()
  FROM public.kanban_cards c
  JOIN LATERAL (
    VALUES
      (
        'preobra:data_aprovacao_condominio',
        CASE WHEN c.condominio_aprovada_em IS NULL THEN NULL
             ELSE (c.condominio_aprovada_em AT TIME ZONE 'UTC')::date::text END
      ),
      (
        'preobra:data_aprovacao_prefeitura',
        CASE WHEN c.prefeitura_aprovada_em IS NULL THEN NULL
             ELSE (c.prefeitura_aprovada_em AT TIME ZONE 'UTC')::date::text END
      ),
      (
        'preobra:data_emissao_alvara',
        CASE WHEN c.alvara_emitido_em IS NULL THEN NULL
             ELSE (c.alvara_emitido_em AT TIME ZONE 'UTC')::date::text END
      )
  ) AS v(chave, valor) ON TRUE
  WHERE c.kanban_id = v_kanban
    AND v.valor IS NOT NULL
  ON CONFLICT (card_id, chave) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('613', 'operacoes_dados_pre_obra_checklist')
ON CONFLICT (version) DO NOTHING;
