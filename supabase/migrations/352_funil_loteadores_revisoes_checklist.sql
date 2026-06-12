-- 352: Funil Loteadores — fase «Revisões»: instruções e checklist de anexos atualizados.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_item_id UUID;
  v_instr TEXT := $instr$
Executar o que precisa ser revisto, redesenhado ou remoldado após o Comitê.
$instr$;
  v_visiveis TEXT[] := ARRAY['anexos_atualizados'];
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '352: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'revisoes_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '352: fase revisoes_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET instrucoes = v_instr,
      nome = 'Revisões'
  WHERE id = v_fase_id;

  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'anexos_atualizados'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 1,
        label = 'Anexos atualizados',
        tipo = 'anexo_multiplo',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = '{"permite_link":true}'::jsonb
    WHERE id = v_item_id;
  ELSE
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'arquivos_revisados'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 1,
          label = 'Anexos atualizados',
          tipo = 'anexo_multiplo',
          obrigatorio = false,
          visivel_candidato = true,
          campo_slug = 'anexos_atualizados',
          config_json = '{"permite_link":true}'::jsonb
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 1, 'Anexos atualizados', 'anexo_multiplo', false, true, 'anexos_atualizados',
        '{"permite_link":true}'::jsonb
      );
    END IF;
  END IF;

  -- Migrar respostas legadas arquivos_revisados → anexos_atualizados
  INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em)
  SELECT dest.id, src.card_id, src.valor, src.arquivo_path, src.preenchido_por, src.preenchido_em
  FROM public.kanban_fase_checklist_respostas src
  JOIN public.kanban_fase_checklist_itens orig ON orig.id = src.item_id
  JOIN public.kanban_fase_checklist_itens dest
    ON dest.fase_id = v_fase_id AND dest.campo_slug = 'anexos_atualizados'
  WHERE orig.fase_id = v_fase_id
    AND orig.campo_slug = 'arquivos_revisados'
    AND (COALESCE(TRIM(src.valor), '') <> '' OR src.arquivo_path IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_respostas r2
      WHERE r2.item_id = dest.id AND r2.card_id = src.card_id
        AND (COALESCE(TRIM(r2.valor), '') <> '' OR r2.arquivo_path IS NOT NULL)
    )
  ON CONFLICT (item_id, card_id) DO NOTHING;

  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND (campo_slug IS NULL OR NOT (COALESCE(campo_slug, '') = ANY (v_visiveis)));
END;
$$;
