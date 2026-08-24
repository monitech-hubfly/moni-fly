-- 545: Funil Pré Obra + Funil Obra (kanbans + 10 fases cada).
-- Idempotente. DEV first. Não aplicar em PROD sem confirmação.
-- UUIDs alinhados a kanban-ids.ts (PRE_OBRA / OBRA).
-- Sem colunas novas em kanban_cards nesta migration (prev_* já existem; obra_ok em migration seguinte).

-- ─── Funil Pré Obra ──────────────────────────────────────────────────────────
INSERT INTO public.kanbans (id, nome, descricao, cor_hex, ativo)
SELECT
  '91686091-077d-479d-bbb3-cb062ded286e'::uuid,
  'Funil Pré Obra',
  'Da assinatura do contrato até a mobilização da equipe de obra',
  '#1E3A5F',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans
  WHERE id = '91686091-077d-479d-bbb3-cb062ded286e'::uuid
     OR nome = 'Funil Pré Obra'
);

INSERT INTO public.kanban_fases (
  kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  f.sla_dias,
  f.sla_tipo,
  f.fase_conversao,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Briefing Inicial',            'pre_briefing',          1,  2, 'uteis'::text,    false),
    ('Análise de Viabilidade',      'pre_viabilidade',       2,  5, 'uteis',          false),
    ('Proposta Comercial',          'pre_proposta',          3,  3, 'uteis',          false),
    ('Contrato e Documentação',     'pre_contrato',          4, 10, 'uteis',          false),
    ('Projeto Arquitetônico',       'pre_projeto_arq',       5, 30, 'uteis',          false),
    ('Aprovação de Projeto',        'pre_aprovacao_projeto', 6, 60, 'corridos',       false),
    ('Projetos Complementares',     'pre_projetos_comp',     7, 20, 'uteis',          false),
    ('Orçamento Executivo',         'pre_orcamento',         8, 10, 'uteis',          false),
    ('Planejamento e Cronograma',   'pre_planejamento',      9,  7, 'uteis',          false),
    ('Mobilização',                 'pre_mobilizacao',      10,  5, 'uteis',          true)
) AS f(nome, slug, ordem, sla_dias, sla_tipo, fase_conversao)
WHERE k.nome = 'Funil Pré Obra'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.slug = f.slug
  );

UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = v.sla_tipo,
  fase_conversao = v.fase_conversao,
  ativo = true
FROM public.kanbans k,
  (VALUES
    ('pre_briefing',          'Briefing Inicial',            1,  2, 'uteis'::text,    false),
    ('pre_viabilidade',       'Análise de Viabilidade',      2,  5, 'uteis',          false),
    ('pre_proposta',          'Proposta Comercial',          3,  3, 'uteis',          false),
    ('pre_contrato',          'Contrato e Documentação',     4, 10, 'uteis',          false),
    ('pre_projeto_arq',       'Projeto Arquitetônico',       5, 30, 'uteis',          false),
    ('pre_aprovacao_projeto', 'Aprovação de Projeto',        6, 60, 'corridos',       false),
    ('pre_projetos_comp',     'Projetos Complementares',     7, 20, 'uteis',          false),
    ('pre_orcamento',         'Orçamento Executivo',         8, 10, 'uteis',          false),
    ('pre_planejamento',      'Planejamento e Cronograma',   9,  7, 'uteis',          false),
    ('pre_mobilizacao',       'Mobilização',                10,  5, 'uteis',          true)
  ) AS v(slug, nome, ordem, sla_dias, sla_tipo, fase_conversao)
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Pré Obra'
  AND kf.slug = v.slug;

-- ─── Funil Obra ──────────────────────────────────────────────────────────────
INSERT INTO public.kanbans (id, nome, descricao, cor_hex, ativo)
SELECT
  '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b'::uuid,
  'Funil Obra',
  'Da mobilização até a entrega das chaves e emissão do habite-se',
  '#2D5D9E',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans
  WHERE id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b'::uuid
     OR nome = 'Funil Obra'
);

INSERT INTO public.kanban_fases (
  kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  f.sla_dias,
  f.sla_tipo,
  f.fase_conversao,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Serviços Preliminares',       'obra_preliminares',  1, 15, 'corridos'::text, false),
    ('Fundação',                    'obra_fundacao',      2, 30, 'corridos',       false),
    ('Estrutura',                   'obra_estrutura',     3, 45, 'corridos',       false),
    ('Vedações e Cobertura',        'obra_vedacoes',      4, 30, 'corridos',       false),
    ('Instalações',                 'obra_instalacoes',   5, 45, 'corridos',       false),
    ('Revestimentos',               'obra_revestimentos', 6, 40, 'corridos',       false),
    ('Esquadrias e Acabamentos',    'obra_acabamentos',   7, 30, 'corridos',       false),
    ('Paisagismo e Áreas Externas', 'obra_paisagismo',    8, 20, 'corridos',       false),
    ('Vistoria Final',              'obra_vistoria',      9, 10, 'corridos',       false),
    ('Habite-se e Entrega',        'obra_entrega',      10, 15, 'corridos',       true)
) AS f(nome, slug, ordem, sla_dias, sla_tipo, fase_conversao)
WHERE k.nome = 'Funil Obra'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.slug = f.slug
  );

UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = v.sla_tipo,
  fase_conversao = v.fase_conversao,
  ativo = true
FROM public.kanbans k,
  (VALUES
    ('obra_preliminares',  'Serviços Preliminares',       1, 15, 'corridos'::text, false),
    ('obra_fundacao',      'Fundação',                    2, 30, 'corridos',       false),
    ('obra_estrutura',     'Estrutura',                   3, 45, 'corridos',       false),
    ('obra_vedacoes',      'Vedações e Cobertura',        4, 30, 'corridos',       false),
    ('obra_instalacoes',   'Instalações',                 5, 45, 'corridos',       false),
    ('obra_revestimentos', 'Revestimentos',               6, 40, 'corridos',       false),
    ('obra_acabamentos',   'Esquadrias e Acabamentos',    7, 30, 'corridos',       false),
    ('obra_paisagismo',    'Paisagismo e Áreas Externas', 8, 20, 'corridos',       false),
    ('obra_vistoria',      'Vistoria Final',              9, 10, 'corridos',       false),
    ('obra_entrega',       'Habite-se e Entrega',       10, 15, 'corridos',       true)
  ) AS v(slug, nome, ordem, sla_dias, sla_tipo, fase_conversao)
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Obra'
  AND kf.slug = v.slug;

NOTIFY pgrst, 'reload schema';
