-- 259: Funil Step One — fase Lotes disponíveis: separa "Identificação do lote" em Quadra + Lote.

DO $$
DECLARE
  v_fase_id UUID;
  v_old_item_id UUID;
  v_quadra_item_id UUID;
  v_lote_item_id UUID;
  v_resp RECORD;
  v_valor TEXT;
  v_quadra TEXT;
  v_lote TEXT;
  v_slash INT;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('lotes_disponiveis', 'stepone_lotes')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'lotes_disponiveis' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '259: fase lotes_disponiveis não encontrada; pulando.';
    RETURN;
  END IF;

  SELECT i.id
  INTO v_old_item_id
  FROM public.kanban_fase_checklist_itens i
  WHERE i.fase_id = v_fase_id
    AND i.label IN ('Identificação do lote', 'Identificação do lote (quadra/lote)')
  ORDER BY CASE WHEN i.label = 'Identificação do lote (quadra/lote)' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT i.id INTO v_quadra_item_id
  FROM public.kanban_fase_checklist_itens i
  WHERE i.fase_id = v_fase_id AND i.label = 'Quadra'
  LIMIT 1;

  SELECT i.id INTO v_lote_item_id
  FROM public.kanban_fase_checklist_itens i
  WHERE i.fase_id = v_fase_id AND i.label = 'Lote'
  LIMIT 1;

  IF v_quadra_item_id IS NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
    VALUES (v_fase_id, 999, 'Quadra', 'texto_curto', true, true, 'Ex.: 12')
    RETURNING id INTO v_quadra_item_id;
  END IF;

  IF v_lote_item_id IS NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
    VALUES (v_fase_id, 998, 'Lote', 'texto_curto', true, true, 'Ex.: 34')
    RETURNING id INTO v_lote_item_id;
  END IF;

  IF v_old_item_id IS NOT NULL THEN
    FOR v_resp IN
      SELECT r.card_id, r.valor, r.arquivo_path, r.preenchido_por, r.preenchido_em
      FROM public.kanban_fase_checklist_respostas r
      WHERE r.item_id = v_old_item_id
    LOOP
      v_valor := TRIM(COALESCE(v_resp.valor, ''));
      v_quadra := '';
      v_lote := '';

      IF v_valor <> '' THEN
        v_slash := POSITION('/' IN v_valor);
        IF v_slash > 0 THEN
          v_quadra := TRIM(SUBSTRING(v_valor FROM 1 FOR v_slash - 1));
          v_lote := TRIM(SUBSTRING(v_valor FROM v_slash + 1));
        ELSIF v_valor ~* 'lote\s*[:\-]?\s*\S' AND v_valor ~* 'quadra\s*[:\-]?\s*\S' THEN
          v_quadra := TRIM((regexp_match(v_valor, 'quadra\s*[:\-]?\s*([^,;/]+)', 'i'))[1]);
          v_lote := TRIM((regexp_match(v_valor, 'lote\s*[:\-]?\s*([^,;/]+)', 'i'))[1]);
        ELSIF v_valor ~ '^[Qq]\s*\d+' THEN
          v_quadra := TRIM((regexp_match(v_valor, '^[Qq]\s*(\S+)', 'i'))[1]);
          v_lote := TRIM(COALESCE((regexp_match(v_valor, '[Ll]\s*(\S+)', 'i'))[1], ''));
        ELSE
          v_quadra := v_valor;
        END IF;
      END IF;

      IF v_quadra <> '' THEN
        INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em)
        VALUES (v_quadra_item_id, v_resp.card_id, v_quadra, v_resp.arquivo_path, v_resp.preenchido_por, v_resp.preenchido_em)
        ON CONFLICT (item_id, card_id) DO UPDATE
          SET valor = EXCLUDED.valor,
              preenchido_em = COALESCE(EXCLUDED.preenchido_em, kanban_fase_checklist_respostas.preenchido_em);
      END IF;

      IF v_lote <> '' THEN
        INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em)
        VALUES (v_lote_item_id, v_resp.card_id, v_lote, NULL, v_resp.preenchido_por, v_resp.preenchido_em)
        ON CONFLICT (item_id, card_id) DO UPDATE
          SET valor = EXCLUDED.valor,
              preenchido_em = COALESCE(EXCLUDED.preenchido_em, kanban_fase_checklist_respostas.preenchido_em);
      END IF;
    END LOOP;

    DELETE FROM public.kanban_fase_checklist_respostas WHERE item_id = v_old_item_id;
    DELETE FROM public.kanban_fase_checklist_itens WHERE id = v_old_item_id;
  END IF;

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id
    AND label IN ('Identificação do lote', 'Identificação do lote (quadra/lote)');

  -- Reordena só na primeira aplicação (item legado removido ou Quadra/Lote ainda em ordem temporária).
  IF v_old_item_id IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens i
      WHERE i.id IN (v_quadra_item_id, v_lote_item_id) AND i.ordem >= 100
    )
  THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = ordem + 1
    WHERE fase_id = v_fase_id
      AND id NOT IN (v_quadra_item_id, v_lote_item_id)
      AND ordem >= 1;

    UPDATE public.kanban_fase_checklist_itens SET ordem = 1 WHERE id = v_quadra_item_id;
    UPDATE public.kanban_fase_checklist_itens SET ordem = 2 WHERE id = v_lote_item_id;
  END IF;
END;
$$;
