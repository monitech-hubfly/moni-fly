-- 311: Funil Loteadores — fase «Contrato de Parceria» após Moní Capital.

DO $$
DECLARE
  v_kanban_id UUID;
  v_ordem_moni_capital INT;
  v_sla_dias INT;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome IN ('Funil Loteadores', 'Funil Moní INC')
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '311: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug = 'contrato_parceria_moni_inc'
  ) THEN
    RAISE NOTICE '311: fase Contrato de Parceria já existe; pulando.';
    RETURN;
  END IF;

  SELECT ordem, sla_dias
  INTO v_ordem_moni_capital, v_sla_dias
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'moni_capital_moni_inc'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_ordem_moni_capital IS NULL THEN
    RAISE NOTICE '311: fase Moní Capital não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id
    AND ordem > v_ordem_moni_capital
    AND COALESCE(ativo, true) = true;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
  VALUES (
    v_kanban_id,
    'Contrato de Parceria',
    'contrato_parceria_moni_inc',
    v_ordem_moni_capital + 1,
    COALESCE(v_sla_dias, 7),
    true,
    NULL,
    '[]'::jsonb
  );
END;
$$;
