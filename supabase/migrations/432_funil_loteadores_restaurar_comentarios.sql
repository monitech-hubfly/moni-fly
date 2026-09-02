-- 432: Funil Loteadores — restaurar campos Comentários (R1) e Comentários finais (R2) no checklist.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_r1_id UUID;
  v_fase_r2_id UUID;
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
    RAISE NOTICE '432: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  -- R1 — Conceito: restaurar Comentários
  SELECT id INTO v_fase_r1_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'r1_conceito_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_r1_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 18,
        label = 'Comentários',
        tipo = 'texto_longo',
        obrigatorio = false,
        visivel_candidato = true,
        config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
    WHERE fase_id = v_fase_r1_id
      AND (
        COALESCE(campo_slug, '') = 'comentarios'
        OR TRIM(label) = 'Comentários'
      );

    IF NOT FOUND THEN
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      )
      SELECT
        v_fase_r1_id, 18, 'Comentários', 'texto_longo', false, true, 'comentarios', '{}'::jsonb
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.kanban_fase_checklist_itens
        WHERE fase_id = v_fase_r1_id
          AND (
            COALESCE(campo_slug, '') = 'comentarios'
            OR TRIM(label) = 'Comentários'
          )
      );
    END IF;
  ELSE
    RAISE NOTICE '432: fase r1_conceito_moni_inc não encontrada; pulando R1.';
  END IF;

  -- R2 — Plano Teórico: restaurar Comentários finais (sem alterar adendos_observacoes)
  SELECT id INTO v_fase_r2_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'r2_plano_teorico_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_r2_id IS NOT NULL THEN
    v_item_id := NULL;
    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_r2_id
      AND campo_slug = 'comentarios_finais'
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = 5,
          label = 'Comentários finais',
          tipo = 'texto_longo',
          obrigatorio = false,
          visivel_candidato = true,
          config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      )
      SELECT
        v_fase_r2_id, 5, 'Comentários finais', 'texto_longo', false, true, 'comentarios_finais', '{}'::jsonb
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.kanban_fase_checklist_itens
        WHERE fase_id = v_fase_r2_id
          AND campo_slug = 'comentarios_finais'
      );
    END IF;
  ELSE
    RAISE NOTICE '432: fase r2_plano_teorico_moni_inc não encontrada; pulando R2.';
  END IF;
END;
$$;
