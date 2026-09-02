-- 347: Funil Loteadores — fase «Viabilidade»: instruções e checklist (spec operacional).

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_item_id UUID;
  v_fase_rec RECORD;
  v_instr TEXT := $instr$
Fazer mapa de competidores para validar escolha da casa e documentar o lote escolhido para showroom (planta, fotos, vídeos, casas para simulação, manual de obra e gadgets).
$instr$;
  v_visiveis TEXT[] := ARRAY[
    'mapa_competidores',
    'lote_showroom_quadra',
    'lote_showroom',
    'planta_cadastral_lote',
    'fotos_lote',
    'videos_lote',
    'casas_simulacao',
    'manual_obra',
    'gadgets'
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
    RAISE NOTICE '347: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  FOR v_fase_rec IN
    SELECT id, slug
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug IN ('viabilidade_moni_inc', 'dados_loteador_moni_inc')
      AND COALESCE(ativo, true) = true
  LOOP
    v_fase_id := v_fase_rec.id;

    UPDATE public.kanban_fases
    SET instrucoes = v_instr,
        nome = CASE
          WHEN v_fase_rec.slug = 'dados_loteador_moni_inc' THEN nome
          ELSE 'Viabilidade'
        END
    WHERE id = v_fase_id;

    -- 1. Mapa de Competidores (link)
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'mapa_competidores'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 1, label = 'Mapa de Competidores', tipo = 'url', obrigatorio = false,
          visivel_candidato = true, config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 1, 'Mapa de Competidores', 'url', false, true, 'mapa_competidores', '{}'::jsonb
      );
    END IF;

    -- 2. Lote escolhido para showroom (quadra — decimal)
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'lote_showroom_quadra'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 2, label = 'Lote escolhido para showroom', tipo = 'numero', obrigatorio = false,
          visivel_candidato = true, config_json = '{"decimal":true,"step":"any"}'::jsonb
      WHERE id = v_item_id;
    ELSE
      SELECT id INTO v_item_id
      FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND campo_slug = 'quadra_showroom'
      LIMIT 1;

      IF v_item_id IS NOT NULL THEN
        UPDATE public.kanban_fase_checklist_itens
        SET ordem = 2, label = 'Lote escolhido para showroom', tipo = 'numero', obrigatorio = false,
            visivel_candidato = true, campo_slug = 'lote_showroom_quadra',
            config_json = '{"decimal":true,"step":"any"}'::jsonb
        WHERE id = v_item_id;
      ELSE
        INSERT INTO public.kanban_fase_checklist_itens (
          fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
        ) VALUES (
          v_fase_id, 2, 'Lote escolhido para showroom', 'numero', false, true, 'lote_showroom_quadra',
          '{"decimal":true,"step":"any"}'::jsonb
        );
      END IF;
    END IF;

    -- 3. Lote escolhido para showroom (lote — decimal)
    v_item_id := NULL;
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'lote_showroom'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 3, label = 'Lote escolhido para showroom', tipo = 'numero', obrigatorio = false,
          visivel_candidato = true, config_json = '{"decimal":true,"step":"any"}'::jsonb
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 3, 'Lote escolhido para showroom', 'numero', false, true, 'lote_showroom',
        '{"decimal":true,"step":"any"}'::jsonb
      );
    END IF;

    -- 4. Planta cadastral com medidas do lote e topografia
    v_item_id := NULL;
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'planta_cadastral_lote'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 4,
          label = 'Planta cadastral com medidas do lote e topografia',
          tipo = 'anexo', obrigatorio = false, visivel_candidato = true,
          config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      SELECT id INTO v_item_id
      FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND campo_slug = 'planta_lote'
      LIMIT 1;

      IF v_item_id IS NOT NULL THEN
        UPDATE public.kanban_fase_checklist_itens
        SET ordem = 4,
            label = 'Planta cadastral com medidas do lote e topografia',
            tipo = 'anexo', obrigatorio = false, visivel_candidato = true,
            campo_slug = 'planta_cadastral_lote',
            config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
        WHERE id = v_item_id;
      ELSE
        INSERT INTO public.kanban_fase_checklist_itens (
          fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
        ) VALUES (
          v_fase_id, 4, 'Planta cadastral com medidas do lote e topografia', 'anexo', false, true,
          'planta_cadastral_lote', '{}'::jsonb
        );
      END IF;
    END IF;

    -- 5. Fotos do lote escolhido
    v_item_id := NULL;
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'fotos_lote'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 5, label = 'Fotos do lote escolhido', tipo = 'anexo_multiplo', obrigatorio = false,
          visivel_candidato = true, config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 5, 'Fotos do lote escolhido', 'anexo_multiplo', false, true, 'fotos_lote', '{}'::jsonb
      );
    END IF;

    -- 6. Vídeos do lote escolhido
    v_item_id := NULL;
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'videos_lote'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 6, label = 'Vídeos do lote escolhido', tipo = 'anexo_multiplo', obrigatorio = false,
          visivel_candidato = true, config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 6, 'Vídeos do lote escolhido', 'anexo_multiplo', false, true, 'videos_lote', '{}'::jsonb
      );
    END IF;

    -- 7. Escolher 3 casas para simulação
    v_item_id := NULL;
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'casas_simulacao'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 7, label = 'Escolher 3 casas para simulação', tipo = 'texto_longo', obrigatorio = false,
          visivel_candidato = true, config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 7, 'Escolher 3 casas para simulação', 'texto_longo', false, true, 'casas_simulacao', '{}'::jsonb
      );
    END IF;

    -- 8. Manual de Obra
    v_item_id := NULL;
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'manual_obra'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 8, label = 'Manual de Obra', tipo = 'anexo', obrigatorio = false,
          visivel_candidato = true, config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 8, 'Manual de Obra', 'anexo', false, true, 'manual_obra', '{}'::jsonb
      );
    END IF;

    -- 9. Gadgets
    v_item_id := NULL;
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = 'gadgets'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 9, label = 'Gadgets', tipo = 'texto_longo', obrigatorio = false,
          visivel_candidato = true, config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, 9, 'Gadgets', 'texto_longo', false, true, 'gadgets', '{}'::jsonb
      );
    END IF;

    -- Ocultar extras
    UPDATE public.kanban_fase_checklist_itens
    SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
        obrigatorio = false
    WHERE fase_id = v_fase_id
      AND (campo_slug IS NULL OR NOT (COALESCE(campo_slug, '') = ANY (v_visiveis)))
      AND tipo <> 'rede_loteador';

    -- Migrar casas catalog → texto único
    INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em)
    SELECT dest.id, agg.card_id, agg.valor, NULL, NULL, NOW()
    FROM (
      SELECT r.card_id,
        NULLIF(
          TRIM(BOTH E'\n' FROM string_agg(
            TRIM(i.label || ': ' || COALESCE(r.valor, '')),
            E'\n' ORDER BY i.ordem
          )),
          ''
        ) AS valor
      FROM public.kanban_fase_checklist_respostas r
      JOIN public.kanban_fase_checklist_itens i ON i.id = r.item_id
      WHERE i.fase_id = v_fase_id
        AND i.campo_slug IN ('casa_1', 'casa_2', 'casa_3')
        AND COALESCE(TRIM(r.valor), '') <> ''
      GROUP BY r.card_id
    ) agg
    JOIN public.kanban_fase_checklist_itens dest
      ON dest.fase_id = v_fase_id AND dest.campo_slug = 'casas_simulacao'
    WHERE agg.valor IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.kanban_fase_checklist_respostas r2
        WHERE r2.item_id = dest.id AND r2.card_id = agg.card_id AND COALESCE(TRIM(r2.valor), '') <> ''
      )
    ON CONFLICT (item_id, card_id) DO NOTHING;

    -- Migrar topografia legada → planta cadastral (se planta vazia)
    INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em)
    SELECT dest.id, src.card_id, src.valor, src.arquivo_path, src.preenchido_por, src.preenchido_em
    FROM public.kanban_fase_checklist_respostas src
    JOIN public.kanban_fase_checklist_itens orig ON orig.id = src.item_id
    JOIN public.kanban_fase_checklist_itens dest
      ON dest.fase_id = v_fase_id AND dest.campo_slug = 'planta_cadastral_lote'
    WHERE orig.fase_id = v_fase_id
      AND orig.campo_slug = 'topografia'
      AND (src.arquivo_path IS NOT NULL OR COALESCE(TRIM(src.valor), '') <> '')
      AND NOT EXISTS (
        SELECT 1 FROM public.kanban_fase_checklist_respostas r2
        WHERE r2.item_id = dest.id AND r2.card_id = src.card_id
          AND (r2.arquivo_path IS NOT NULL OR COALESCE(TRIM(r2.valor), '') <> '')
      )
    ON CONFLICT (item_id, card_id) DO NOTHING;

  END LOOP;
END;
$$;
