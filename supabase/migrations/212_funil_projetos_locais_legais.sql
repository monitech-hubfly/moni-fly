-- 212: Funis Projetos Locais e Projetos Legais (idempotente por nome do kanban e slug da fase)

-- ═══════════════════════════════════════════════════════════════════════════
-- Funil Projetos Locais
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.kanbans (nome, descricao, ativo)
SELECT 'Funil Projetos Locais', 'Arquitetura e projeto executivo do empreendimento', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans WHERE nome = 'Funil Projetos Locais'
);

INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  f.sla_dias,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Briefing arquitetura', 'projetos_locais_briefing', 1, 2),
    ('Projeto executivo', 'projetos_locais_execucao', 2, 20),
    ('Compatibilização', 'projetos_locais_compatibilizacao', 3, 5),
    ('Aprovação no condomínio', 'projetos_locais_aprovacao', 4, NULL::integer),
    ('Concluído', 'projetos_locais_concluido', 5, NULL::integer)
) AS f(nome, slug, ordem, sla_dias)
WHERE k.nome = 'Funil Projetos Locais'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.slug = f.slug
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- Funil Projetos Legais
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.kanbans (nome, descricao, ativo)
SELECT 'Funil Projetos Legais', 'Protocolo, exigências e alvará na prefeitura', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans WHERE nome = 'Funil Projetos Legais'
);

INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  f.sla_dias,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Protocolo prefeitura', 'projetos_legais_protocolo', 1, 5),
    ('Respondendo exigências', 'projetos_legais_exigencias', 2, 5),
    ('Aguardando alvará', 'projetos_legais_aguardando', 3, NULL::integer),
    ('Alvará emitido', 'projetos_legais_alvara', 4, NULL::integer),
    ('Concluído', 'projetos_legais_concluido', 5, NULL::integer)
) AS f(nome, slug, ordem, sla_dias)
WHERE k.nome = 'Funil Projetos Legais'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.slug = f.slug
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTs
-- ═══════════════════════════════════════════════════════════════════════════
GRANT SELECT ON public.kanbans TO authenticated, anon;
GRANT SELECT ON public.kanban_fases TO authenticated, anon;
