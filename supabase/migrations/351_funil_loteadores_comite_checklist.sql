-- 351: Funil Loteadores — fase «Comitê»: instruções e checklist simplificado.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_item_id UUID;
  v_instr TEXT := $instr$
Apresentar o projeto para os envolvidos da Casa Moní em Viabilidade de Novos Negócios, colher pareceres e desenhar possibilidades para moldar o negócio.
$instr$;
  v_visiveis TEXT[] := ARRAY['apresentacao_comite'];
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '351: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'comite_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '351: fase comite_moni_inc não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET instrucoes = v_instr,
      nome = 'Comitê'
  WHERE id = v_fase_id;

  -- 1. Apresentação para Comitê
  SELECT id INTO v_item_id
  FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND campo_slug = 'apresentacao_comite'
  LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = 1, label = 'Apresentação para Comitê', tipo = 'url', obrigatorio = false,
        visivel_candidato = true, config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
    WHERE id = v_item_id;
  ELSE
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    ) VALUES (
      v_fase_id, 1, 'Apresentação para Comitê', 'url', false, true, 'apresentacao_comite', '{}'::jsonb
    );
  END IF;

  -- Ocultar extras
  UPDATE public.kanban_fase_checklist_itens
  SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb,
      obrigatorio = false
  WHERE fase_id = v_fase_id
    AND (campo_slug IS NULL OR NOT (COALESCE(campo_slug, '') = ANY (v_visiveis)));
END;
$$;
