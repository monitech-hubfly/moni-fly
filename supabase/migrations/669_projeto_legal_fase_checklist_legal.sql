-- 669: Funil Projeto Legal — fase Checklist Legal após Pontos em Aberto.
-- Não move cards. Idempotente.

DO $$
DECLARE
  v_kanban uuid := '39de341d-aebf-481c-9118-ce6fc6574187'::uuid;
  v_fase uuid := 'b8e2c4d1-7a31-4e5f-9d62-1c3f5a8e6b04'::uuid;
  v_ord_pontos int;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    SELECT id INTO v_kanban
    FROM public.kanbans
    WHERE nome = 'Funil Projeto Legal'
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban IS NULL THEN
    RAISE NOTICE '669: Funil Projeto Legal não encontrado — pulando fase.';
    RETURN;
  END IF;

  SELECT f.ordem
  INTO v_ord_pontos
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_kanban
    AND f.slug = 'pl_pontos_em_aberto'
  ORDER BY f.ativo DESC, f.ordem
  LIMIT 1;

  INSERT INTO public.kanban_fases (
    id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
  )
  SELECT
    v_fase,
    v_kanban,
    'Checklist Legal',
    'pl_checklist_legal',
    COALESCE(v_ord_pontos, 2) + 1,
    NULL,
    'uteis',
    false,
    true,
    'Checklist legal do projeto, depois de Pontos em Aberto.',
    '[]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_kanban
      AND f.slug = 'pl_checklist_legal'
  );

  UPDATE public.kanban_fases
  SET
    nome = 'Checklist Legal',
    ativo = true,
    sla_dias = NULL,
    sla_tipo = 'uteis',
    fase_conversao = false,
    instrucoes = 'Checklist legal do projeto, depois de Pontos em Aberto.'
  WHERE kanban_id = v_kanban
    AND slug = 'pl_checklist_legal';

  IF v_ord_pontos IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.kanban_fases f
       WHERE f.kanban_id = v_kanban
         AND f.ordem = v_ord_pontos + 1
         AND f.slug <> 'pl_checklist_legal'
     )
  THEN
    UPDATE public.kanban_fases
    SET ordem = ordem + 1
    WHERE kanban_id = v_kanban
      AND ordem > v_ord_pontos
      AND slug <> 'pl_checklist_legal';
  END IF;

  IF v_ord_pontos IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET ordem = v_ord_pontos + 1
    WHERE kanban_id = v_kanban
      AND slug = 'pl_checklist_legal';
  END IF;

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id
    FROM (
      VALUES
        (1, 'pl_nova_demanda'),
        (2, 'pl_pontos_em_aberto'),
        (3, 'pl_checklist_legal'),
        (4, 'pl_em_execucao'),
        (5, 'pl_em_validacao'),
        (6, 'pl_c_protocolo_andamento'),
        (7, 'pl_c_em_comuniquese'),
        (8, 'pl_c_validacao_comuniquese'),
        (9, 'pl_p_protocolo_andamento'),
        (10, 'pl_p_em_comuniquese'),
        (11, 'pl_p_validacao_comuniquese'),
        (12, 'pl_p_projeto_aprovado'),
        (13, 'pl_pagamentos')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf
      ON kf.kanban_id = v_kanban
     AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases
    SET ordem = v_ord,
        ativo = true
    WHERE id = r.id;
  END LOOP;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT f.id, 0, 'Responsável do card', 'usuario', false, false, 'responsavel_fase', '{"oculto_ui": true}'::jsonb
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_kanban
    AND f.slug = 'pl_checklist_legal'
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
    AND f.slug = 'pl_checklist_legal'
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_da_fase'
    );
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('669', 'projeto_legal_fase_checklist_legal')
ON CONFLICT (version) DO NOTHING;
