-- 612: Funil Pré Obra e Obra — Comunique-se após cada aprovação.
-- Não move cards. Idempotente.

DO $$
DECLARE
  v_kanban_id uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome IN ('Funil Pré Obra e Obra', 'Funil Operações')
    ORDER BY CASE WHEN nome = 'Funil Pré Obra e Obra' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '612: Funil Pré Obra e Obra não encontrado — pulando.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fases (
    id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
  )
  SELECT
    v.id,
    v_kanban_id,
    v.nome,
    v.slug,
    90,
    NULL,
    'uteis',
    false,
    true,
    v.instrucoes,
    '[]'::jsonb
  FROM (
    VALUES
      (
        'b7c4e2a1-6d30-4f8a-9c15-2d8e4f6a1c11'::uuid,
        'Comunique-se Condomínio',
        'comunique_se_condominio',
        'Registrar os comunique-se do condomínio depois da aprovação.'
      ),
      (
        'b7c4e2a2-6d30-4f8a-9c15-2d8e4f6a1c12'::uuid,
        'Comunique-se Prefeitura',
        'comunique_se_prefeitura',
        'Registrar os comunique-se da prefeitura depois da aprovação.'
      )
  ) AS v(id, nome, slug, instrucoes)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_kanban_id
      AND f.slug = v.slug
  );

  UPDATE public.kanban_fases f
  SET
    nome = v.nome,
    sla_dias = NULL,
    sla_tipo = 'uteis',
    fase_conversao = false,
    ativo = true,
    instrucoes = v.instrucoes
  FROM (
    VALUES
      (
        'comunique_se_condominio',
        'Comunique-se Condomínio',
        'Registrar os comunique-se do condomínio depois da aprovação.'
      ),
      (
        'comunique_se_prefeitura',
        'Comunique-se Prefeitura',
        'Registrar os comunique-se da prefeitura depois da aprovação.'
      )
  ) AS v(slug, nome, instrucoes)
  WHERE f.kanban_id = v_kanban_id
    AND f.slug = v.slug;

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id
    FROM (
      VALUES
        (1, 'planialtimetrico'),
        (2, 'projeto_legal'),
        (3, 'aprovacao_condominio'),
        (4, 'comunique_se_condominio'),
        (5, 'aprovacao_prefeitura'),
        (6, 'comunique_se_prefeitura'),
        (7, 'revisao_bca'),
        (8, 'processos_cartorarios'),
        (9, 'aguardando_credito'),
        (10, 'em_obra'),
        (11, 'operacoes_entregue')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf
      ON kf.kanban_id = v_kanban_id
     AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases
    SET ordem = v_ord, ativo = true
    WHERE id = r.id;
  END LOOP;

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
  WHERE f.kanban_id = v_kanban_id
    AND f.slug IN ('comunique_se_condominio', 'comunique_se_prefeitura')
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
  WHERE f.kanban_id = v_kanban_id
    AND f.slug IN ('comunique_se_condominio', 'comunique_se_prefeitura')
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_da_fase'
    );
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('612', 'operacoes_fases_comunique_se')
ON CONFLICT (version) DO NOTHING;
