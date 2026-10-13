-- 617: Funil Pré Obra e Obra — divide «Revisão BCA + Instrumento Garantidor».
-- A fase existente (slug revisao_bca) passa a se chamar Comitê Ops.
-- Instrumento Garantidor entra logo depois. Cards não são movidos.
-- Idempotente.

DO $$
DECLARE
  v_kanban uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
  v_fase uuid := 'b7c4e2a3-6d30-4f8a-9c15-2d8e4f6a1c13'::uuid;
  v_sla int;
  v_sla_tipo text;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    SELECT id INTO v_kanban
    FROM public.kanbans
    WHERE nome IN ('Funil Pré Obra e Obra', 'Funil Operações')
    ORDER BY CASE WHEN nome = 'Funil Pré Obra e Obra' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_kanban IS NULL THEN
    RAISE NOTICE '617: Funil Pré Obra e Obra não encontrado — pulando.';
    RETURN;
  END IF;

  SELECT f.sla_dias, f.sla_tipo
  INTO v_sla, v_sla_tipo
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_kanban
    AND f.slug = 'revisao_bca'
  LIMIT 1;

  UPDATE public.kanban_fases
  SET nome = 'Comitê Ops'
  WHERE kanban_id = v_kanban
    AND slug = 'revisao_bca'
    AND nome IS DISTINCT FROM 'Comitê Ops';

  INSERT INTO public.kanban_fases (
    id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
  )
  SELECT
    v_fase,
    v_kanban,
    'Instrumento Garantidor',
    'instrumento_garantidor',
    90,
    v_sla,
    COALESCE(v_sla_tipo, 'uteis'),
    false,
    true,
    'Contratar e apresentar o instrumento garantidor ao terrenista antes da transferência do terreno.',
    '[]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_kanban
      AND f.slug = 'instrumento_garantidor'
  );

  UPDATE public.kanban_fases
  SET
    nome = 'Instrumento Garantidor',
    ativo = true,
    sla_tipo = COALESCE(sla_tipo, v_sla_tipo, 'uteis')
  WHERE kanban_id = v_kanban
    AND slug = 'instrumento_garantidor';

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, chave_compartilhada
  )
  SELECT
    nova.id,
    i.ordem,
    i.label,
    i.tipo,
    i.obrigatorio,
    i.visivel_candidato,
    i.campo_slug,
    i.config_json,
    i.chave_compartilhada
  FROM public.kanban_fase_checklist_itens i
  JOIN public.kanban_fases origem
    ON origem.id = i.fase_id
   AND origem.kanban_id = v_kanban
   AND origem.slug = 'revisao_bca'
  JOIN public.kanban_fases nova
    ON nova.kanban_id = v_kanban
   AND nova.slug = 'instrumento_garantidor'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = nova.id
      AND x.campo_slug IS NOT DISTINCT FROM i.campo_slug
      AND x.label = i.label
  );

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
        (8, 'instrumento_garantidor'),
        (9, 'processos_cartorarios'),
        (10, 'aguardando_credito'),
        (11, 'em_obra'),
        (12, 'operacoes_entregue')
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
VALUES ('617', 'operacoes_split_comite_ops_instrumento')
ON CONFLICT (version) DO NOTHING;
