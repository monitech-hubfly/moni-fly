-- 313: Funil Loteadores — ordem canônica das fases e SLAs (dias úteis).

DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome IN ('Funil Loteadores', 'Funil Moní INC')
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '313: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases AS kf
  SET
    ordem = v.ordem,
    sla_dias = COALESCE(v.sla_dias, kf.sla_dias)
  FROM (
    VALUES
      ('primeiro_contato_moni_inc', 1, 2),
      ('r1_conceito_moni_inc', 2, 5),
      ('dados_loteador_moni_inc', 3, 3),
      ('acoplamento_moni_inc', 4, 5),
      ('r2_plano_teorico_moni_inc', 5, 2),
      ('comite_moni_inc', 6, 3),
      ('r3_ajustes_finais_moni_inc', 7, 2),
      ('abertura_spe_moni_inc', 8, 3),
      ('fechar_contrato_moni_inc', 9, 5),
      ('moni_capital_moni_inc', 10, NULL::integer),
      ('contrato_parceria_moni_inc', 11, NULL::integer)
  ) AS v(slug, ordem, sla_dias)
  WHERE kf.kanban_id = v_kanban_id
    AND kf.slug = v.slug
    AND COALESCE(kf.ativo, true) = true;
END;
$$;
