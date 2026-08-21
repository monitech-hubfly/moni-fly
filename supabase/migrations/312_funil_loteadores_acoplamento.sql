-- 312: Funil Loteadores — fase «Acoplamento» após Dados do Loteador (ou após R1 se 309 ainda não rodou).

DO $$
DECLARE
  v_kanban_id UUID;
  v_ordem_anchor INT;
  v_sla_dias INT := 5;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome IN ('Funil Loteadores', 'Funil Moní INC')
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '312: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug = 'acoplamento_moni_inc'
  ) THEN
    RAISE NOTICE '312: fase Acoplamento já existe; pulando.';
    RETURN;
  END IF;

  SELECT ordem
  INTO v_ordem_anchor
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'dados_loteador_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_ordem_anchor IS NULL THEN
    SELECT ordem
    INTO v_ordem_anchor
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug = 'r1_conceito_moni_inc'
      AND COALESCE(ativo, true) = true
    LIMIT 1;
  END IF;

  IF v_ordem_anchor IS NULL THEN
    RAISE NOTICE '312: fase âncora (Dados do Loteador / R1) não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id
    AND ordem > v_ordem_anchor
    AND COALESCE(ativo, true) = true;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
  VALUES (
    v_kanban_id,
    'Acoplamento',
    'acoplamento_moni_inc',
    v_ordem_anchor + 1,
    v_sla_dias,
    true,
    NULL,
    '[]'::jsonb
  );
END;
$$;
