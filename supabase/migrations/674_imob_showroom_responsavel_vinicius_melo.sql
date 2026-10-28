-- 674: Funil IMOB e Funil Showroom — responsável do card é Vinícius Melo em todas as fases.
-- O campo é kanban_fase_checklist_respostas.valor (UUID do profile). Não move cards.

DO $$
DECLARE
  v_imob uuid := 'f3a8c1d4-6b20-4e91-8d47-2c5e9a1b7f03'::uuid;
  v_showroom uuid := 'e7b1c4d2-8a30-4f91-9c62-5d3a8e1b4f06'::uuid;
  v_profile uuid;
  v_updated int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_imob) THEN
    SELECT id INTO v_imob FROM public.kanbans WHERE nome = 'Funil IMOB' LIMIT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_showroom) THEN
    SELECT id INTO v_showroom FROM public.kanbans WHERE nome = 'Funil Showroom' LIMIT 1;
  END IF;

  SELECT id INTO v_profile
  FROM public.profiles
  WHERE lower(trim(email)) = 'vinicius.melo@moni.casa'
  LIMIT 1;

  IF v_profile IS NULL THEN
    RAISE NOTICE '674: profile vinicius.melo@moni.casa não encontrado — pulando.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT
    f.id,
    0,
    'Responsável do card',
    'usuario',
    false,
    false,
    'responsavel_fase',
    '{"oculto_ui": true}'::jsonb
  FROM public.kanban_fases f
  WHERE f.kanban_id IN (v_imob, v_showroom)
    AND f.ativo IS NOT FALSE
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_fase'
    );

  INSERT INTO public.kanban_fase_checklist_respostas (
    item_id, card_id, valor, preenchido_em
  )
  SELECT
    i.id,
    c.id,
    v_profile::text,
    NOW()
  FROM public.kanban_cards c
  JOIN public.kanban_fases f
    ON f.kanban_id = c.kanban_id
   AND f.ativo IS NOT FALSE
  JOIN public.kanban_fase_checklist_itens i
    ON i.fase_id = f.id
   AND i.campo_slug = 'responsavel_fase'
  WHERE c.kanban_id IN (v_imob, v_showroom)
    AND COALESCE(c.arquivado, false) = false
  ON CONFLICT (item_id, card_id) DO UPDATE
  SET
    valor = EXCLUDED.valor,
    preenchido_em = EXCLUDED.preenchido_em
  WHERE kanban_fase_checklist_respostas.valor IS DISTINCT FROM EXCLUDED.valor;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '674: responsável do card = Vinícius Melo em % resposta(s) de IMOB e Showroom.', v_updated;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('674', 'imob_showroom_responsavel_vinicius_melo')
ON CONFLICT (version) DO NOTHING;
