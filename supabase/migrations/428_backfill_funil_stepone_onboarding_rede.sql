-- 428: Backfill idempotente — card Onboarding no Funil Step One para rede_franqueados sem card.
-- Leve: só INSERT onde NOT EXISTS; fase Onboarding (276) com fallback à 1ª fase ativa.

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_row RECORD;
  v_user_id UUID;
  v_titulo TEXT;
  v_criados INT := 0;
BEGIN
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One' AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '428: kanban Funil Step One não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('onboarding', 'stepone_onboarding')
    AND COALESCE(ativo, true) = true
  ORDER BY ordem ASC
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    SELECT id INTO v_fase_id
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND COALESCE(ativo, true) = true
    ORDER BY ordem ASC
    LIMIT 1;
  END IF;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '428: nenhuma fase ativa no Funil Step One; pulando.';
    RETURN;
  END IF;

  FOR v_row IN
    SELECT rf.id, rf.nome_completo, rf.n_franquia, rf.processo_id
    FROM public.rede_franqueados rf
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.kanban_cards kc
      WHERE kc.kanban_id = v_kanban_id
        AND kc.rede_franqueado_id = rf.id
    )
    LIMIT 200
  LOOP
    v_user_id := NULL;

    SELECT p.id INTO v_user_id
    FROM public.profiles p
    WHERE p.rede_franqueado_id = v_row.id
    LIMIT 1;

    IF v_user_id IS NULL AND v_row.processo_id IS NOT NULL THEN
      SELECT ps.user_id INTO v_user_id
      FROM public.processo_step_one ps
      WHERE ps.id = v_row.processo_id
      LIMIT 1;
    END IF;

    IF v_user_id IS NULL THEN
      SELECT ps.user_id INTO v_user_id
      FROM public.processo_step_one ps
      WHERE ps.origem_rede_franqueados_id = v_row.id
      ORDER BY ps.created_at DESC NULLS LAST
      LIMIT 1;
    END IF;

    IF v_user_id IS NULL THEN
      SELECT p.id INTO v_user_id
      FROM public.profiles p
      WHERE p.role IN ('admin', 'team')
      ORDER BY p.created_at ASC NULLS LAST
      LIMIT 1;
    END IF;

    IF v_user_id IS NULL THEN
      CONTINUE;
    END IF;

    v_titulo := NULLIF(TRIM(COALESCE(v_row.n_franquia, '')), '');
    IF v_titulo IS NULL THEN
      v_titulo := NULLIF(TRIM(COALESCE(v_row.nome_completo, '')), '');
    END IF;
    IF v_titulo IS NULL THEN
      v_titulo := 'Franqueado';
    END IF;

    UPDATE public.kanban_cards kc
    SET rede_franqueado_id = v_row.id,
        fase_id = v_fase_id,
        titulo = v_titulo
    WHERE kc.id = (
      SELECT k2.id
      FROM public.kanban_cards k2
      WHERE k2.kanban_id = v_kanban_id
        AND k2.rede_franqueado_id IS NULL
        AND k2.titulo ILIKE v_titulo || '%'
      ORDER BY k2.created_at DESC
      LIMIT 1
    );

    IF FOUND THEN
      v_criados := v_criados + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.kanban_cards (
      kanban_id, fase_id, franqueado_id, rede_franqueado_id, titulo, status
    )
    VALUES (
      v_kanban_id, v_fase_id, v_user_id, v_row.id, v_titulo, 'ativo'
    );

    v_criados := v_criados + 1;
  END LOOP;

  RAISE NOTICE '428: cards criados/reparados no Funil Step One (Onboarding): %', v_criados;
END;
$$;
