-- 625: Funil Acoplamento divide Modelagem da Casa + GBox em
-- Modelagem da Casa (1 dia útil) e Gbox (1 dia útil).
-- O checklist Gbox vai para a fase nova. Cards permanecem na fase atual.
-- Idempotente.

DO $$
DECLARE
  v_kanban uuid := '15847602-231d-4937-a06f-82027eb87ef3'::uuid;
  v_gbox uuid := 'a7c3e1b2-6d30-4f8a-9c15-2d8e4f6a1c25'::uuid;
  v_gbox_id uuid;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    SELECT id INTO v_kanban
    FROM public.kanbans
    WHERE nome = 'Funil Acoplamento'
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban IS NULL THEN
    RAISE NOTICE '625: kanban Funil Acoplamento não encontrado; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET
    nome = 'Modelagem da Casa',
    sla_dias = 1,
    sla_tipo = 'uteis'
  WHERE kanban_id = v_kanban
    AND slug = 'modelagem_casa_gbox';

  INSERT INTO public.kanban_fases (
    id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, materiais
  )
  SELECT
    v_gbox,
    v_kanban,
    'Gbox',
    'gbox_acoplamento',
    200,
    1,
    'uteis',
    false,
    true,
    '[]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_kanban
      AND f.slug = 'gbox_acoplamento'
  );

  UPDATE public.kanban_fases
  SET
    nome = 'Gbox',
    sla_dias = 1,
    sla_tipo = 'uteis',
    fase_conversao = false,
    ativo = true
  WHERE kanban_id = v_kanban
    AND slug = 'gbox_acoplamento';

  SELECT f.id INTO v_gbox_id
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_kanban
    AND f.slug = 'gbox_acoplamento'
  LIMIT 1;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT f.id, 0, 'Responsável do card', 'usuario', false, false, 'responsavel_fase', '{"oculto_ui": true}'::jsonb
  FROM public.kanban_fases f
  WHERE f.id = v_gbox_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_fase'
    );

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT
    f.id,
    -2,
    'Responsável da fase',
    'select',
    false,
    false,
    'responsavel_da_fase',
    '{"oculto_ui": true, "opcoes": ["Franqueado", "Loteador", "Moní"]}'::jsonb
  FROM public.kanban_fases f
  WHERE f.id = v_gbox_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_da_fase'
    );

  UPDATE public.kanban_fase_checklist_itens i
  SET fase_id = v_gbox_id
  FROM public.kanban_fases f
  WHERE i.fase_id = f.id
    AND f.kanban_id = v_kanban
    AND f.slug = 'modelagem_casa_gbox'
    AND lower(trim(i.label)) LIKE 'gbox%'
    AND v_gbox_id IS NOT NULL;

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id
    FROM (
      VALUES
        (1, 'novo_acoplamento'),
        (2, 'modelagem_terreno'),
        (3, 'modelagem_casa_gbox'),
        (4, 'gbox_acoplamento'),
        (5, 'validacao_acoplamento'),
        (6, 'aguardando_comite_acoplamento'),
        (7, 'alteracoes_acoplamento'),
        (8, 'acoplamento_aprovado'),
        (9, 'acoplamento_reprovado')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf
      ON kf.kanban_id = v_kanban
     AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases
    SET ordem = v_ord, ativo = true
    WHERE id = r.id;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('625', 'acoplamento_modelagem_casa_gbox')
ON CONFLICT (version) DO NOTHING;
