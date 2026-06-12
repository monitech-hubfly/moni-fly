-- 344: Funil Loteadores — fase «Primeiro Contato»: somente 3 campos de checklist.
-- Preserva respostas legadas; oculta itens extras via config_json.oculto_ui.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS hora_reuniao TEXT;

COMMENT ON COLUMN public.kanban_cards.hora_reuniao IS
  'Horário planejado da reunião (HH:MM). Usado pelo checklist Primeiro Contato e como padrão do card.';

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_item_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '344: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'primeiro_contato_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '344: fase primeiro_contato_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  -- Upsert: Como foi o primeiro contato?
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'como_foi_primeiro_contato'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 1,
        label = 'Como foi o primeiro contato?',
        tipo = 'texto_longo',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 1, 'Como foi o primeiro contato?', 'texto_longo', false, true, 'como_foi_primeiro_contato', '{}'::jsonb
    );
  END IF;

  -- Upsert: Data da Reunião
  v_item_id := NULL;
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'data_reuniao'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 2,
        label = 'Data da Reunião',
        tipo = 'data',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
    WHERE id = v_item_id;
  ELSE
    -- Reaproveita item legado sem slug (migration 160)
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id
      AND label = 'Data da Reunião'
      AND (campo_slug IS NULL OR campo_slug = '')
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 2,
          tipo = 'data',
          obrigatorio = false,
          visivel_candidato = true,
          campo_slug = 'data_reuniao',
          config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 2, 'Data da Reunião', 'data', false, true, 'data_reuniao', '{}'::jsonb
      );
    END IF;
  END IF;

  -- Upsert: Horário da Reunião
  v_item_id := NULL;
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'horario_reuniao'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 3,
        label = 'Horário da Reunião',
        tipo = 'hora',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
    WHERE id = v_item_id;
  ELSE
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id
      AND label = 'Horário da Reunião'
      AND (campo_slug IS NULL OR campo_slug = '')
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 3,
          tipo = 'hora',
          obrigatorio = false,
          visivel_candidato = true,
          campo_slug = 'horario_reuniao',
          config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 3, 'Horário da Reunião', 'hora', false, true, 'horario_reuniao', '{}'::jsonb
      );
    END IF;
  END IF;

  -- Ocultar demais itens da fase (preserva respostas)
  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND COALESCE(campo_slug, '') NOT IN (
      'como_foi_primeiro_contato',
      'data_reuniao',
      'horario_reuniao'
    );

  -- Migrar respostas legadas → slugs canônicos (somente se destino vazio)
  INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em)
  SELECT dest.id, src.card_id, src.valor, src.arquivo_path, src.preenchido_por, src.preenchido_em
  FROM public.kanban_fase_checklist_respostas src
  JOIN public.kanban_fase_checklist_itens orig ON orig.id = src.item_id
  JOIN public.kanban_fase_checklist_itens dest
    ON dest.fase_id = v_fase_id
   AND dest.campo_slug = 'como_foi_primeiro_contato'
  WHERE orig.fase_id = v_fase_id
    AND orig.campo_slug = 'primeiro_contato_descricao'
    AND COALESCE(TRIM(src.valor), '') <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_respostas r2
      WHERE r2.item_id = dest.id AND r2.card_id = src.card_id AND COALESCE(TRIM(r2.valor), '') <> ''
    )
  ON CONFLICT (item_id, card_id) DO NOTHING;

  INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em)
  SELECT dest.id, src.card_id, src.valor, src.arquivo_path, src.preenchido_por, src.preenchido_em
  FROM public.kanban_fase_checklist_respostas src
  JOIN public.kanban_fase_checklist_itens orig ON orig.id = src.item_id
  JOIN public.kanban_fase_checklist_itens dest
    ON dest.fase_id = v_fase_id
   AND dest.campo_slug = 'data_reuniao'
  WHERE orig.fase_id = v_fase_id
    AND orig.label = 'Data da Reunião'
    AND COALESCE(orig.campo_slug, '') <> 'data_reuniao'
    AND COALESCE(TRIM(src.valor), '') <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_respostas r2
      WHERE r2.item_id = dest.id AND r2.card_id = src.card_id AND COALESCE(TRIM(r2.valor), '') <> ''
    )
  ON CONFLICT (item_id, card_id) DO NOTHING;

  INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em)
  SELECT dest.id, src.card_id, src.valor, src.arquivo_path, src.preenchido_por, src.preenchido_em
  FROM public.kanban_fase_checklist_respostas src
  JOIN public.kanban_fase_checklist_itens orig ON orig.id = src.item_id
  JOIN public.kanban_fase_checklist_itens dest
    ON dest.fase_id = v_fase_id
   AND dest.campo_slug = 'horario_reuniao'
  WHERE orig.fase_id = v_fase_id
    AND orig.label = 'Horário da Reunião'
    AND COALESCE(orig.campo_slug, '') <> 'horario_reuniao'
    AND COALESCE(TRIM(src.valor), '') <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_respostas r2
      WHERE r2.item_id = dest.id AND r2.card_id = src.card_id AND COALESCE(TRIM(r2.valor), '') <> ''
    )
  ON CONFLICT (item_id, card_id) DO NOTHING;

  -- Preencher hora_reuniao do card a partir de respostas existentes
  UPDATE public.kanban_cards k
  SET hora_reuniao = sub.valor
  FROM (
    SELECT r.card_id, TRIM(r.valor) AS valor
    FROM public.kanban_fase_checklist_respostas r
    JOIN public.kanban_fase_checklist_itens i ON i.id = r.item_id
    WHERE i.fase_id = v_fase_id
      AND i.campo_slug = 'horario_reuniao'
      AND COALESCE(TRIM(r.valor), '') <> ''
  ) sub
  WHERE k.id = sub.card_id
    AND COALESCE(TRIM(k.hora_reuniao), '') = '';
END;
$$;
