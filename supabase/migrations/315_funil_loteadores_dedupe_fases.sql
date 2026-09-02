-- 315: Funil Loteadores — desativa fases duplicadas (ex.: dois «Primeiro Contato»).
-- Move cards para a fase canônica (slug *_moni_inc) e desativa cópias extras.

DO $$
DECLARE
  v_kanban_id UUID;
  v_phase RECORD;
  v_canonical_id UUID;
  v_dup RECORD;
  v_canonical_nome TEXT;
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
    RAISE NOTICE '315: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  FOR v_phase IN
    SELECT * FROM (VALUES
      ('Primeiro Contato'::text, 'primeiro_contato_moni_inc'::text),
      ('R1 Executada: "Conceito"', 'r1_conceito_moni_inc'),
      ('Dados do Loteador', 'dados_loteador_moni_inc'),
      ('Acoplamento', 'acoplamento_moni_inc'),
      ('R2 Apresentar Plano Teórico', 'r2_plano_teorico_moni_inc'),
      ('Comitê', 'comite_moni_inc'),
      ('R3: Ajustes Finais nas Propostas', 'r3_ajustes_finais_moni_inc'),
      ('Abertura SPE', 'abertura_spe_moni_inc'),
      ('Fechar Contrato', 'fechar_contrato_moni_inc'),
      ('Moní Capital', 'moni_capital_moni_inc'),
      ('Contrato de Parceria', 'contrato_parceria_moni_inc')
    ) AS t(nome, slug)
  LOOP
    SELECT kf.id, kf.nome
    INTO v_canonical_id, v_canonical_nome
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = v_kanban_id
      AND kf.slug = v_phase.slug
    ORDER BY COALESCE(kf.ativo, true) DESC, kf.id
    LIMIT 1;

    IF v_canonical_id IS NULL THEN
      SELECT kf.id, kf.nome
      INTO v_canonical_id, v_canonical_nome
      FROM public.kanban_fases kf
      LEFT JOIN public.kanban_cards kc ON kc.fase_id = kf.id
      WHERE kf.kanban_id = v_kanban_id
        AND lower(btrim(kf.nome)) = lower(btrim(v_phase.nome))
      GROUP BY kf.id, kf.nome
      ORDER BY COUNT(kc.id) DESC, kf.id
      LIMIT 1;

      IF v_canonical_id IS NOT NULL THEN
        UPDATE public.kanban_fases
        SET slug = v_phase.slug, nome = v_phase.nome, ativo = true
        WHERE id = v_canonical_id;
      END IF;
    END IF;

    IF v_canonical_id IS NULL THEN
      CONTINUE;
    END IF;

    v_canonical_nome := COALESCE(v_canonical_nome, v_phase.nome);

    FOR v_dup IN
      SELECT kf.id
      FROM public.kanban_fases kf
      WHERE kf.kanban_id = v_kanban_id
        AND kf.id <> v_canonical_id
        AND COALESCE(kf.ativo, true) = true
        AND (
          lower(btrim(kf.nome)) = lower(btrim(v_canonical_nome))
          OR lower(btrim(kf.nome)) = lower(btrim(v_phase.nome))
        )
    LOOP
      UPDATE public.kanban_cards
      SET fase_id = v_canonical_id
      WHERE fase_id = v_dup.id;

      UPDATE public.kanban_fases
      SET ativo = false
      WHERE id = v_dup.id;
    END LOOP;
  END LOOP;

  -- Desativa fases legadas do fluxo loteador_cadastro (migration 206) se ainda ativas.
  UPDATE public.kanban_fases
  SET ativo = false
  WHERE kanban_id = v_kanban_id
    AND slug IN (
      'loteador_cadastro',
      'loteador_analise',
      'loteador_docs',
      'loteador_juridico',
      'loteador_concluido'
    )
    AND COALESCE(ativo, true) = true;
END;
$$;
