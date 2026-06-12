-- 335: Funil Loteadores — fase «Diligência» antes de Moní Capital.

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
    RAISE NOTICE '335: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug = 'diligencia_moni_inc'
  ) THEN
    SELECT ordem, sla_dias
    INTO v_ordem_moni_capital, v_sla_dias
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug = 'moni_capital_moni_inc'
      AND COALESCE(ativo, true) = true
    LIMIT 1;

    IF v_ordem_moni_capital IS NULL THEN
      SELECT ordem + 1, sla_dias
      INTO v_ordem_moni_capital, v_sla_dias
      FROM public.kanban_fases
      WHERE kanban_id = v_kanban_id
        AND slug = 'fechar_contrato_moni_inc'
        AND COALESCE(ativo, true) = true
      LIMIT 1;
    END IF;

    IF v_ordem_moni_capital IS NULL THEN
      RAISE NOTICE '335: fases Moní Capital / Fechar Contrato não encontradas; pulando insert.';
    ELSE
      UPDATE public.kanban_fases
      SET ordem = ordem + 1
      WHERE kanban_id = v_kanban_id
        AND ordem >= v_ordem_moni_capital
        AND COALESCE(ativo, true) = true;

      INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
      VALUES (
        v_kanban_id,
        'Diligência',
        'diligencia_moni_inc',
        v_ordem_moni_capital,
        10,
        true,
        $instr$
Após o contrato fechado, conduza a diligência jurídica e documental do loteador antes de encaminhar à Moní Capital.
$instr$,
        '[]'::jsonb
      );
    END IF;
  END IF;

  UPDATE public.kanban_fases AS kf
  SET
    nome = v.nome,
    ordem = v.ordem,
    sla_dias = COALESCE(v.sla_dias, kf.sla_dias),
    ativo = true
  FROM (
    VALUES
      ('Primeiro Contato'::text, 'primeiro_contato_moni_inc'::text, 1, 2),
      ('R1 Executada: "Conceito"', 'r1_conceito_moni_inc', 2, 5),
      ('Dados do Loteador', 'dados_loteador_moni_inc', 3, 3),
      ('Acoplamento', 'acoplamento_moni_inc', 4, 5),
      ('R2 Apresentar Plano Teórico', 'r2_plano_teorico_moni_inc', 5, 2),
      ('Comitê', 'comite_moni_inc', 6, 3),
      ('R3: Ajustes Finais nas Propostas', 'r3_ajustes_finais_moni_inc', 7, 2),
      ('Abertura SPE', 'abertura_spe_moni_inc', 8, 3),
      ('Fechar Contrato', 'fechar_contrato_moni_inc', 9, 5),
      ('Diligência', 'diligencia_moni_inc', 10, 10),
      ('Moní Capital', 'moni_capital_moni_inc', 11, NULL::integer),
      ('Contrato de Parceria', 'contrato_parceria_moni_inc', 12, NULL::integer)
  ) AS v(nome, slug, ordem, sla_dias)
  WHERE kf.kanban_id = v_kanban_id
    AND kf.slug = v.slug
    AND COALESCE(kf.ativo, true) = true;
END;
$$;
