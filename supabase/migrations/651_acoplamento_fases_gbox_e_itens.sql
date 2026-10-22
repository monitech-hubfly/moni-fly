-- 651: Funil Acoplamento — Verificar Itens Fora do Padrão antes de Modelagem do Terreno
-- e Aguardando alteração da GBOX logo após Gbox. Cards não são movidos.
-- Aplicar DEV primeiro; PROD somente com confirmação explícita.

DO $$
DECLARE
  v_kanban uuid := '15847602-231d-4937-a06f-82027eb87ef3'::uuid;
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
    RAISE NOTICE '651: Funil Acoplamento não encontrado; pulando.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fases (
    id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, materiais
  )
  SELECT
    v.id,
    v_kanban,
    v.nome,
    v.slug,
    200,
    v.sla_dias,
    'uteis',
    false,
    true,
    '[]'::jsonb
  FROM (
    VALUES
      (
        'c4e8a1b2-6d30-4f8a-9c15-2d8e4f6a1c31'::uuid,
        'Verificar Itens Fora do Padrão',
        'verificar_itens_fora_do_padrao',
        1
      ),
      (
        'c4e8a1b2-6d30-4f8a-9c15-2d8e4f6a1c32'::uuid,
        'Aguardando alteração da GBOX',
        'aguardando_alteracao_gbox',
        NULL::int
      )
  ) AS v(id, nome, slug, sla_dias)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_kanban
      AND f.slug = v.slug
  );

  UPDATE public.kanban_fases f
  SET
    nome = v.nome,
    sla_dias = v.sla_dias,
    sla_tipo = 'uteis',
    fase_conversao = false,
    ativo = true
  FROM (
    VALUES
      ('verificar_itens_fora_do_padrao', 'Verificar Itens Fora do Padrão', 1),
      ('aguardando_alteracao_gbox', 'Aguardando alteração da GBOX', NULL::int)
  ) AS v(slug, nome, sla_dias)
  WHERE f.kanban_id = v_kanban
    AND f.slug = v.slug;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT f.id, 0, 'Responsável do card', 'usuario', false, false, 'responsavel_fase', '{"oculto_ui": true}'::jsonb
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_kanban
    AND f.slug IN ('verificar_itens_fora_do_padrao', 'aguardando_alteracao_gbox')
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
  WHERE f.kanban_id = v_kanban
    AND f.slug IN ('verificar_itens_fora_do_padrao', 'aguardando_alteracao_gbox')
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_da_fase'
    );

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id
    FROM (
      VALUES
        (1, 'novo_acoplamento'),
        (2, 'verificar_itens_fora_do_padrao'),
        (3, 'modelagem_terreno'),
        (4, 'modelagem_casa_gbox'),
        (5, 'gbox_acoplamento'),
        (6, 'aguardando_alteracao_gbox'),
        (7, 'validacao_acoplamento'),
        (8, 'aguardando_comite_acoplamento'),
        (9, 'alteracoes_acoplamento'),
        (10, 'acoplamento_aprovado'),
        (11, 'acoplamento_reprovado')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf
      ON kf.kanban_id = v_kanban
     AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases
    SET ordem = v_ord
    WHERE id = r.id;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('651', 'acoplamento_fases_gbox_e_itens')
ON CONFLICT (version) DO NOTHING;
