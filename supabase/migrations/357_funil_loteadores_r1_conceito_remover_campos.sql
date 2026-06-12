-- 357: Funil Loteadores — R1 Executada — Conceito: ocultar campos legados removidos da spec.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_visiveis TEXT[] := ARRAY[
    'interesse_loteador',
    'preco_atratividade',
    'produto_atratividade',
    'showroom_interesse',
    'showroom_descricao',
    'linhas_receita',
    'casa_que_vende'
  ];
  v_removidos_slug TEXT[] := ARRAY[
    'restricoes',
    'oportunidades',
    'comentarios',
    'score_loteador',
    'classificacao_loteador'
  ];
  v_removidos_label TEXT[] := ARRAY[
    'Restrições',
    'Oportunidades',
    'Comentários',
    'Score do loteador',
    'Classificação do loteador'
  ];
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '357: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'r1_conceito_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '357: fase r1_conceito_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui',
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND COALESCE(campo_slug, '') = ANY (v_visiveis);

  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND (
      COALESCE(campo_slug, '') = ANY (v_removidos_slug)
      OR TRIM(label) = ANY (v_removidos_label)
    );

  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND NOT (COALESCE(campo_slug, '') = ANY (v_visiveis))
    AND NOT (
      TRIM(label) IN (
        'Interesse do loteador',
        'Preço',
        'Preço — atratividade',
        'Produto',
        'Produto — atratividade',
        'Previsão de showroom',
        'Showroom — interesse',
        'Se sim, qual?',
        'Showroom — descrição',
        'Linhas de receita para o loteador',
        'Linhas de receita',
        'Como é a casa que vende lá?',
        'Casa que vende'
      )
    );
END;
$$;
