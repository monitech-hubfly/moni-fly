-- 314: Funil Loteadores — aplica fases canônicas (upsert idempotente).
-- Use esta migration se 307–313 não refletiram no board (SQL nunca rodou em produção).

DO $$
DECLARE
  v_kanban_id UUID;
  v_phase RECORD;
  v_count INT := 0;
BEGIN
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
    AND COALESCE(ativo, true) = true;

  IF v_kanban_id IS NULL THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome = 'Funil Loteadores'
      AND COALESCE(ativo, true) = true
    ORDER BY created_at NULLS LAST
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE EXCEPTION '314: kanban Funil Loteadores não encontrado.';
  END IF;

  FOR v_phase IN
    SELECT * FROM (VALUES
      ('Primeiro Contato'::text, 'primeiro_contato_moni_inc'::text, 1, 2),
      ('R1 Executada: "Conceito"', 'r1_conceito_moni_inc', 2, 5),
      ('Dados do Loteador', 'dados_loteador_moni_inc', 3, 3),
      ('Acoplamento', 'acoplamento_moni_inc', 4, 5),
      ('R2 Apresentar Plano Teórico', 'r2_plano_teorico_moni_inc', 5, 2),
      ('Comitê', 'comite_moni_inc', 6, 3),
      ('R3: Ajustes Finais nas Propostas', 'r3_ajustes_finais_moni_inc', 7, 2),
      ('Abertura SPE', 'abertura_spe_moni_inc', 8, 3),
      ('Fechar Contrato', 'fechar_contrato_moni_inc', 9, 5),
      ('Moní Capital', 'moni_capital_moni_inc', 10, NULL::integer),
      ('Contrato de Parceria', 'contrato_parceria_moni_inc', 11, NULL::integer)
    ) AS t(nome, slug, ordem, sla_dias)
  LOOP
    UPDATE public.kanban_fases AS kf
    SET
      nome = v_phase.nome,
      ordem = v_phase.ordem,
      sla_dias = COALESCE(v_phase.sla_dias, kf.sla_dias),
      ativo = true
    WHERE kf.kanban_id = v_kanban_id
      AND kf.slug = v_phase.slug;

    IF NOT FOUND THEN
      UPDATE public.kanban_fases AS kf
      SET
        nome = v_phase.nome,
        ordem = v_phase.ordem,
        slug = v_phase.slug,
        sla_dias = COALESCE(v_phase.sla_dias, kf.sla_dias),
        ativo = true
      WHERE kf.kanban_id = v_kanban_id
        AND lower(btrim(kf.nome)) = lower(btrim(v_phase.nome));

      IF NOT FOUND THEN
        INSERT INTO public.kanban_fases (
          kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais
        )
        VALUES (
          v_kanban_id,
          v_phase.nome,
          v_phase.slug,
          v_phase.ordem,
          v_phase.sla_dias,
          true,
          NULL,
          '[]'::jsonb
        );
      END IF;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE '314: kanban_id=% — % fases canônicas aplicadas.', v_kanban_id, v_count;
END;
$$;
