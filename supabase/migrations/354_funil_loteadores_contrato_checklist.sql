-- 354: Funil Loteadores — fase «Contrato»: instruções e checklist simplificado.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_item_id UUID;
  v_instr TEXT := $instr$
Assinatura do Contrato De Showroom por todos os envolvidos.
$instr$;
  v_visiveis TEXT[] := ARRAY['contrato_assinado'];
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '354: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'fechar_contrato_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '354: fase fechar_contrato_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET instrucoes = v_instr,
      nome = 'Contrato'
  WHERE id = v_fase_id;

  -- 1. Contrato assinado (anexo)
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'contrato_assinado'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 1,
        label = 'Contrato assinado',
        tipo = 'anexo',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
    WHERE id = v_item_id;
  ELSE
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'contrato_anexado'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 1,
          label = 'Contrato assinado',
          tipo = 'anexo',
          obrigatorio = false,
          visivel_candidato = true,
          campo_slug = 'contrato_assinado',
          config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 1, 'Contrato assinado', 'anexo', false, true, 'contrato_assinado', '{}'::jsonb
      );
    END IF;
  END IF;

  -- Migrar anexo legado contrato_anexado → contrato_assinado (se destino vazio)
  INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em)
  SELECT dest.id, src.card_id, src.valor, src.arquivo_path, src.preenchido_por, src.preenchido_em
  FROM public.kanban_fase_checklist_respostas src
  JOIN public.kanban_fase_checklist_itens orig ON orig.id = src.item_id
  JOIN public.kanban_fase_checklist_itens dest
    ON dest.fase_id = v_fase_id AND dest.campo_slug = 'contrato_assinado'
  WHERE orig.fase_id = v_fase_id
    AND orig.campo_slug = 'contrato_anexado'
    AND (COALESCE(TRIM(src.valor), '') <> '' OR src.arquivo_path IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_respostas r2
      WHERE r2.item_id = dest.id AND r2.card_id = src.card_id
        AND (COALESCE(TRIM(r2.valor), '') <> '' OR r2.arquivo_path IS NOT NULL)
    )
  ON CONFLICT (item_id, card_id) DO NOTHING;

  -- Ocultar extras
  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND (campo_slug IS NULL OR NOT (COALESCE(campo_slug, '') = ANY (v_visiveis)));
END;
$$;
