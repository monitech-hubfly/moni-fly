-- 630: Funil Projetos Locais
--   • Tags do funil (cores distintas, sem laranja).
--   • Renomeia a fase 300 no mesmo registro (slug pl_300_estruturas).
--   • Insere Compatibilização depois de 400 e Em obra antes de Concluído.
--   Checklists e respostas permanecem no fase_id original: nenhum item é
--   apagado, movido ou recriado.

DO $$
DECLARE
  v_kanban uuid := 'c2ab09bd-4bd6-491e-8734-281d7678a6ad';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    SELECT id INTO v_kanban
    FROM public.kanbans
    WHERE nome = 'Funil Projetos Locais'
    LIMIT 1;
  END IF;

  IF v_kanban IS NULL THEN
    RAISE EXCEPTION '630: Funil Projetos Locais não encontrado';
  END IF;

  UPDATE public.kanban_fases
  SET nome = '300 - Muros e fundação'
  WHERE kanban_id = v_kanban
    AND slug = 'pl_300_estruturas'
    AND nome IS DISTINCT FROM '300 - Muros e fundação';

  -- Afasta a ordem só na primeira inclusão, para o UPDATE absoluto não colidir.
  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban AND slug = 'pl_compatibilizacao'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban AND slug = 'pl_em_obra'
  ) THEN
    UPDATE public.kanban_fases
    SET ordem = ordem + 200
    WHERE kanban_id = v_kanban;
  END IF;

  UPDATE public.kanban_fases kf
  SET ordem = v.ordem, ativo = true
  FROM (
    VALUES
      ('pl_000_novo_projeto',        1),
      ('pl_100_layout',              2),
      ('pl_200_preparacao_terreno',  3),
      ('pl_300_estruturas',          4),
      ('pl_400_infraestrutura',      5),
      ('pl_compatibilizacao',        6),
      ('pl_500_garagem',             7),
      ('pl_600_piscina',             8),
      ('pl_700_deck',                9),
      ('pl_800_escada_pisantes',    10),
      ('pl_900_paisagismo',         11),
      ('pl_em_obra',                12),
      ('projetos_locais_concluido', 13)
  ) AS v(slug, ordem)
  WHERE kf.kanban_id = v_kanban
    AND kf.slug = v.slug;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, sla_tipo, ativo, instrucoes, materiais)
  SELECT v_kanban, 'Compatibilização', 'pl_compatibilizacao', 6, NULL, 'uteis', true,
    'Conferência dos projetos depois de 400 - Infraestrutura, antes de seguir para 500.',
    '[]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban AND slug = 'pl_compatibilizacao'
  );

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, sla_tipo, ativo, instrucoes, materiais)
  SELECT v_kanban, 'Em obra', 'pl_em_obra', 12, NULL, 'uteis', true,
    'Projeto liberado para obra, antes de Concluído.',
    '[]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban AND slug = 'pl_em_obra'
  );

  INSERT INTO public.kanban_tags (kanban_id, nome, cor)
  SELECT v_kanban, t.nome, t.cor
  FROM (
    VALUES
      ('Estrutura em andamento',             '#0C2633'),
      ('Projeto complementar em andamento',  '#2F4A3A'),
      ('Revisão',                            '#D4AD68')
  ) AS t(nome, cor)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_tags kt
    WHERE kt.kanban_id = v_kanban AND kt.nome = t.nome
  );

  UPDATE public.kanban_tags kt
  SET cor = t.cor
  FROM (
    VALUES
      ('Estrutura em andamento',             '#0C2633'),
      ('Projeto complementar em andamento',  '#2F4A3A'),
      ('Revisão',                            '#D4AD68')
  ) AS t(nome, cor)
  WHERE kt.kanban_id = v_kanban
    AND kt.nome = t.nome
    AND kt.cor IS DISTINCT FROM t.cor;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('630', 'projetos_locais_tags_fases')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
