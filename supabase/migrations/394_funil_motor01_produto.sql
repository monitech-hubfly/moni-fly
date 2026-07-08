-- 394: Funil Motor 01 — kanban + 13 fases (produto Motor 01).

-- ─── Kanban Motor 01 (UUID fixo — alinhado a kanban-ids.ts) ──────────────────
INSERT INTO public.kanbans (id, nome, descricao, ativo)
SELECT
  '202527ea-d284-4c49-94f5-e75b25d6910e'::uuid,
  'Funil Motor 01',
  'Produto Motor 01 — jornada comercial e contratual',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans
  WHERE id = '202527ea-d284-4c49-94f5-e75b25d6910e'::uuid
     OR nome = 'Funil Motor 01'
);

-- ─── Fases (13 etapas) ───────────────────────────────────────────────────────
INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais)
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
    ('R01 — Apresentação e Boas-Vindas',       'm1_r01',              1,  7,    'uteis',    false),
    ('Acoplamento + GBox + Simulador + IA',    'm1_acoplamento',      2,  3,    'uteis',    false),
    ('R02 — Acoplamento e Orçamento',          'm1_r02',              3,  NULL, 'uteis',    false),
    ('R03 — Ajustes',                          'm1_r03',              4,  NULL, 'uteis',    false),
    ('Cto com Terrenista + Procuração',        'm1_cto_terrenista',   5,  7,    'corridos', false),
    ('Intenção de Compra + Sinal',             'm1_intencao_compra',  6,  NULL, 'uteis',    false),
    ('Cto de Venda para Cliente Final',        'm1_cto_cliente',      7,  NULL, 'uteis',    true),
    ('Pagamento da Entrada Cto Moní',          'm1_pagamento_entrada', 8, NULL, 'uteis',    false),
    ('Custom 0 — Boas-Vindas',                 'm1_custom_0',         9,  NULL, 'uteis',    false),
    ('Custom Track 1',                         'm1_custom_track1',    10, NULL, 'uteis',    false),
    ('Custom Track 2',                         'm1_custom_track2',    11, NULL, 'uteis',    false),
    ('Custom Track 3',                         'm1_custom_track3',    12, NULL, 'uteis',    false),
    ('Custom Final — Aditivo',                 'm1_custom_final',     13, NULL, 'uteis',    false)
) AS f(nome, slug, ordem, sla_dias, sla_tipo, fase_conversao)
WHERE k.nome = 'Funil Motor 01'
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
    ('m1_r01',              'R01 — Apresentação e Boas-Vindas',       1,  7,    'uteis',    false),
    ('m1_acoplamento',      'Acoplamento + GBox + Simulador + IA',    2,  3,    'uteis',    false),
    ('m1_r02',              'R02 — Acoplamento e Orçamento',          3,  NULL, 'uteis',    false),
    ('m1_r03',              'R03 — Ajustes',                          4,  NULL, 'uteis',    false),
    ('m1_cto_terrenista',   'Cto com Terrenista + Procuração',        5,  7,    'corridos', false),
    ('m1_intencao_compra',  'Intenção de Compra + Sinal',             6,  NULL, 'uteis',    false),
    ('m1_cto_cliente',      'Cto de Venda para Cliente Final',        7,  NULL, 'uteis',    true),
    ('m1_pagamento_entrada','Pagamento da Entrada Cto Moní',          8,  NULL, 'uteis',    false),
    ('m1_custom_0',         'Custom 0 — Boas-Vindas',                 9,  NULL, 'uteis',    false),
    ('m1_custom_track1',    'Custom Track 1',                         10, NULL, 'uteis',    false),
    ('m1_custom_track2',    'Custom Track 2',                         11, NULL, 'uteis',    false),
    ('m1_custom_track3',    'Custom Track 3',                         12, NULL, 'uteis',    false),
    ('m1_custom_final',     'Custom Final — Aditivo',                 13, NULL, 'uteis',    false)
  ) AS v(slug, nome, ordem, sla_dias, sla_tipo, fase_conversao)
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Motor 01'
  AND kf.slug = v.slug;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('394', 'funil_motor01_produto')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
