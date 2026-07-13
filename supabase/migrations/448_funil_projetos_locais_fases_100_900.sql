-- 448: Funil Projetos Locais — reorganizar fases nos 9 grupos 100–900
--   Fonte: planilha "DEMANDAS - PROJETO EXECUTIVO LOCAL".
--   • As fases passam a ser os 9 grupos (100..900); "Aprovação no condomínio" e
--     "Concluído" seguem como fases terminais (10 e 11).
--   • Adiciona horas (Modelagem / Documentação / Compatibilização) por item de checklist.
--   • SLA do item     = (mod + doc + comp) / 8h/dia.
--   • SLA da fase (d.u.) = soma do SLA dos itens = CEIL(soma_horas / 8), mínimo 1.
--   • "TER" (terceirizado) e "-" contam como 0h internas. "1 se necessário" = 1h.
--   As 7 etapas de fluxo antigas (projetos_locais_iniciais/estrutura/infraestrutura/
--   compat1/anteprojeto/compat2/executivo) são apenas DESATIVADAS (reversível, sem
--   perda de dados). Idempotente.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Colunas de horas nos itens de checklist (fonte única do cálculo de SLA)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.kanban_fase_checklist_itens
  ADD COLUMN IF NOT EXISTS horas_modelagem        numeric(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_documentacao     numeric(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_compatibilizacao numeric(6,2) DEFAULT 0;

COMMENT ON COLUMN public.kanban_fase_checklist_itens.horas_modelagem IS
  'Horas de modelagem estimadas para o item (base do cálculo de SLA da fase).';
COMMENT ON COLUMN public.kanban_fase_checklist_itens.horas_documentacao IS
  'Horas de documentação estimadas para o item (base do cálculo de SLA da fase).';
COMMENT ON COLUMN public.kanban_fase_checklist_itens.horas_compatibilizacao IS
  'Horas de compatibilização estimadas para o item (base do cálculo de SLA da fase).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Desativa as 7 etapas de fluxo antigas (reversível — não deleta)
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE public.kanban_fases kf
SET ativo = false
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Projetos Locais'
  AND kf.slug IN (
    'projetos_locais_iniciais',
    'projetos_locais_estrutura',
    'projetos_locais_infraestrutura',
    'projetos_locais_compat1',
    'projetos_locais_anteprojeto',
    'projetos_locais_compat2',
    'projetos_locais_executivo'
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. As 9 fases 100–900 (idempotente por slug)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, sla_tipo, ativo, instrucoes, materiais)
SELECT k.id, f.nome, f.slug, f.ordem, 1, 'uteis', true, NULL, '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('100 - Projeto Layout casa + terreno', 'pl_100_layout',              1),
    ('200 - Preparação terreno',            'pl_200_preparacao_terreno',  2),
    ('300 - Estruturas',                    'pl_300_estruturas',          3),
    ('400 - Infraestrutura',                'pl_400_infraestrutura',      4),
    ('500 - Garagem + demais ambientes',    'pl_500_garagem',             5),
    ('600 - Piscina',                       'pl_600_piscina',             6),
    ('700 - Deck',                          'pl_700_deck',                7),
    ('800 - Escada e Pisantes',             'pl_800_escada_pisantes',     8),
    ('900 - Paisagismo',                    'pl_900_paisagismo',          9)
) AS f(nome, slug, ordem)
WHERE k.nome = 'Funil Projetos Locais'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id AND kf.slug = f.slug
  );

UPDATE public.kanban_fases kf
SET nome = v.nome, ordem = v.ordem, sla_tipo = 'uteis', ativo = true
FROM public.kanbans k, (
  VALUES
    ('100 - Projeto Layout casa + terreno', 'pl_100_layout',              1),
    ('200 - Preparação terreno',            'pl_200_preparacao_terreno',  2),
    ('300 - Estruturas',                    'pl_300_estruturas',          3),
    ('400 - Infraestrutura',                'pl_400_infraestrutura',      4),
    ('500 - Garagem + demais ambientes',    'pl_500_garagem',             5),
    ('600 - Piscina',                       'pl_600_piscina',             6),
    ('700 - Deck',                          'pl_700_deck',                7),
    ('800 - Escada e Pisantes',             'pl_800_escada_pisantes',     8),
    ('900 - Paisagismo',                    'pl_900_paisagismo',          9)
) AS v(nome, slug, ordem)
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Projetos Locais'
  AND kf.slug = v.slug;

-- Fases terminais após os grupos (reposiciona)
UPDATE public.kanban_fases kf
SET ordem = 10, ativo = true
FROM public.kanbans k
WHERE kf.kanban_id = k.id AND k.nome = 'Funil Projetos Locais'
  AND kf.slug = 'projetos_locais_aprovacao';

UPDATE public.kanban_fases kf
SET ordem = 11, ativo = true
FROM public.kanbans k
WHERE kf.kanban_id = k.id AND k.nome = 'Funil Projetos Locais'
  AND kf.slug = 'projetos_locais_concluido';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Itens de checklist (com horas) — idempotente por (fase_id, label)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.kanban_fase_checklist_itens
  (fase_id, label, tipo, obrigatorio, ordem, horas_modelagem, horas_documentacao, horas_compatibilizacao)
SELECT kf.id, v.label, 'checkbox', false, v.ordem, v.h_mod, v.h_doc, v.h_comp
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
JOIN (
  VALUES
    -- 100 — Projeto Layout casa + terreno
    ('pl_100_layout', '110 - Layout geral', 1, 8, 4, 0),
    -- 200 — Preparação terreno
    ('pl_200_preparacao_terreno', '210 - Terraplanagem',                                                  1,  4,  8, 0),
    ('pl_200_preparacao_terreno', '220 - Muros simples',                                                  2,  1,  4, 0),
    ('pl_200_preparacao_terreno', '221 - Muros completo (divisa e arrimo)',                               3, 12,  8, 4),
    ('pl_200_preparacao_terreno', '222 - Muros contenção',                                                4, 16, 16, 2),
    ('pl_200_preparacao_terreno', '230 - Canteiros e tapumes',                                            5,  2,  2, 0),
    ('pl_200_preparacao_terreno', '240 - Impermeabilização terreno (muros, casa de máquinas e garagem)',  6,  2,  3, 0),
    ('pl_200_preparacao_terreno', '250 - Pontos de Sondagem no solo',                                     7, 0.5, 0.5, 0),
    ('pl_200_preparacao_terreno', '260 - Análise arquitetura x estrutura',                                8,  2,  0, 0),
    -- 300 — Estruturas
    ('pl_300_estruturas', '310 - Fundação completa', 1, 24, 12, 2),
    ('pl_300_estruturas', '311 - Fundação simples',  2,  6,  4, 1),
    ('pl_300_estruturas', '320 - Casa de máquinas',  3,  4,  4, 1),
    -- 400 — Infraestrutura (TER = terceirizado = 0h)
    ('pl_400_infraestrutura', '410 - Hidráulica pontos',                    1, 2,   3,   0),
    ('pl_400_infraestrutura', '411 - Hidráulica completo (complementares)', 2, 0,   0,   2),
    ('pl_400_infraestrutura', '420 - Elétrica e lógica pontos',             3, 2,   3,   0),
    ('pl_400_infraestrutura', '421 - Elétrica e lógica completo',           4, 0,   0,   2),
    ('pl_400_infraestrutura', '430 - Gás pontos',                           5, 0.5, 1,   0),
    ('pl_400_infraestrutura', '431 - Gás completo',                         6, 0,   0,   2),
    ('pl_400_infraestrutura', '440 - Iluminação simples',                   7, 3,   4,   0),
    ('pl_400_infraestrutura', '441 - Iluminação completo',                  8, 0,   0,   4),
    ('pl_400_infraestrutura', '450 - Circuitos simples',                    9, 0,   2,   0),
    ('pl_400_infraestrutura', '451 - Circuitos completo',                  10, 0,   0,   2),
    ('pl_400_infraestrutura', '460 - Climatização simples',                11, 0.5, 0.5, 0),
    ('pl_400_infraestrutura', '461 - Climatização completo',               12, 0,   0,   2),
    ('pl_400_infraestrutura', '470 - Painel fotovoltaico pontos',          13, 0.5, 1,   0),
    ('pl_400_infraestrutura', '471 - Painel fotovoltaico completo',        14, 0,   0,   1),
    ('pl_400_infraestrutura', '480 - Aspiração central pontos',            15, 0.5, 0.5, 0),
    ('pl_400_infraestrutura', '481 - Aspiração central completo',          16, 0,   0,   1),
    -- 500 — Garagem + demais ambientes
    ('pl_500_garagem', '510 - Paredes internas + Reforços', 1, 4, 8, 0),
    ('pl_500_garagem', '511 - Parede MDF',                  2, 4, 8, 0),
    ('pl_500_garagem', '520 - Contrapiso e Piso',           3, 1, 4, 0),
    ('pl_500_garagem', '530 - Esquadrias',                  4, 1, 3, 0),
    ('pl_500_garagem', '540 - Revestimentos e Pinturas',    5, 2, 5, 0),
    ('pl_500_garagem', '550 - Forro + estrutura forro',     6, 2, 4, 0),
    ('pl_500_garagem', '560 - Louças e Metais',             7, 1, 2, 0),
    ('pl_500_garagem', '570 - Projeto de marmoraria',       8, 2, 4, 0),
    ('pl_500_garagem', '580 - Projeto de marcenaria',       9, 2, 4, 0),
    -- 600 — Piscina
    ('pl_600_piscina', '610 - Projeto piscina', 1, 2, 4, 0),
    -- 700 — Deck
    ('pl_700_deck', '710 - Projeto Deck', 1, 3, 5, 0),
    -- 800 — Escada e Pisantes
    ('pl_800_escada_pisantes', '810 - Escada e Pisantes', 1, 2, 4, 0),
    -- 900 — Paisagismo (920 = 1h se necessário)
    ('pl_900_paisagismo', '910 - Paisagismo simples',  1, 1, 2, 0),
    ('pl_900_paisagismo', '920 - Paisagismo completo',  2, 0, 0, 1)
) AS v(fase_slug, label, ordem, h_mod, h_doc, h_comp)
  ON kf.slug = v.fase_slug
WHERE k.nome = 'Funil Projetos Locais'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = kf.id AND i.label = v.label
  );

-- Sincroniza horas/ordem caso o item já exista (idempotência)
UPDATE public.kanban_fase_checklist_itens i
SET horas_modelagem = v.h_mod, horas_documentacao = v.h_doc, horas_compatibilizacao = v.h_comp, ordem = v.ordem
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
JOIN (
  VALUES
    ('pl_100_layout', '110 - Layout geral', 1, 8, 4, 0),
    ('pl_200_preparacao_terreno', '210 - Terraplanagem',                                                  1,  4,  8, 0),
    ('pl_200_preparacao_terreno', '220 - Muros simples',                                                  2,  1,  4, 0),
    ('pl_200_preparacao_terreno', '221 - Muros completo (divisa e arrimo)',                               3, 12,  8, 4),
    ('pl_200_preparacao_terreno', '222 - Muros contenção',                                                4, 16, 16, 2),
    ('pl_200_preparacao_terreno', '230 - Canteiros e tapumes',                                            5,  2,  2, 0),
    ('pl_200_preparacao_terreno', '240 - Impermeabilização terreno (muros, casa de máquinas e garagem)',  6,  2,  3, 0),
    ('pl_200_preparacao_terreno', '250 - Pontos de Sondagem no solo',                                     7, 0.5, 0.5, 0),
    ('pl_200_preparacao_terreno', '260 - Análise arquitetura x estrutura',                                8,  2,  0, 0),
    ('pl_300_estruturas', '310 - Fundação completa', 1, 24, 12, 2),
    ('pl_300_estruturas', '311 - Fundação simples',  2,  6,  4, 1),
    ('pl_300_estruturas', '320 - Casa de máquinas',  3,  4,  4, 1),
    ('pl_400_infraestrutura', '410 - Hidráulica pontos',                    1, 2,   3,   0),
    ('pl_400_infraestrutura', '411 - Hidráulica completo (complementares)', 2, 0,   0,   2),
    ('pl_400_infraestrutura', '420 - Elétrica e lógica pontos',             3, 2,   3,   0),
    ('pl_400_infraestrutura', '421 - Elétrica e lógica completo',           4, 0,   0,   2),
    ('pl_400_infraestrutura', '430 - Gás pontos',                           5, 0.5, 1,   0),
    ('pl_400_infraestrutura', '431 - Gás completo',                         6, 0,   0,   2),
    ('pl_400_infraestrutura', '440 - Iluminação simples',                   7, 3,   4,   0),
    ('pl_400_infraestrutura', '441 - Iluminação completo',                  8, 0,   0,   4),
    ('pl_400_infraestrutura', '450 - Circuitos simples',                    9, 0,   2,   0),
    ('pl_400_infraestrutura', '451 - Circuitos completo',                  10, 0,   0,   2),
    ('pl_400_infraestrutura', '460 - Climatização simples',                11, 0.5, 0.5, 0),
    ('pl_400_infraestrutura', '461 - Climatização completo',               12, 0,   0,   2),
    ('pl_400_infraestrutura', '470 - Painel fotovoltaico pontos',          13, 0.5, 1,   0),
    ('pl_400_infraestrutura', '471 - Painel fotovoltaico completo',        14, 0,   0,   1),
    ('pl_400_infraestrutura', '480 - Aspiração central pontos',            15, 0.5, 0.5, 0),
    ('pl_400_infraestrutura', '481 - Aspiração central completo',          16, 0,   0,   1),
    ('pl_500_garagem', '510 - Paredes internas + Reforços', 1, 4, 8, 0),
    ('pl_500_garagem', '511 - Parede MDF',                  2, 4, 8, 0),
    ('pl_500_garagem', '520 - Contrapiso e Piso',           3, 1, 4, 0),
    ('pl_500_garagem', '530 - Esquadrias',                  4, 1, 3, 0),
    ('pl_500_garagem', '540 - Revestimentos e Pinturas',    5, 2, 5, 0),
    ('pl_500_garagem', '550 - Forro + estrutura forro',     6, 2, 4, 0),
    ('pl_500_garagem', '560 - Louças e Metais',             7, 1, 2, 0),
    ('pl_500_garagem', '570 - Projeto de marmoraria',       8, 2, 4, 0),
    ('pl_500_garagem', '580 - Projeto de marcenaria',       9, 2, 4, 0),
    ('pl_600_piscina', '610 - Projeto piscina', 1, 2, 4, 0),
    ('pl_700_deck', '710 - Projeto Deck', 1, 3, 5, 0),
    ('pl_800_escada_pisantes', '810 - Escada e Pisantes', 1, 2, 4, 0),
    ('pl_900_paisagismo', '910 - Paisagismo simples',  1, 1, 2, 0),
    ('pl_900_paisagismo', '920 - Paisagismo completo',  2, 0, 0, 1)
) AS v(fase_slug, label, ordem, h_mod, h_doc, h_comp)
  ON kf.slug = v.fase_slug
WHERE i.fase_id = kf.id AND i.label = v.label AND k.nome = 'Funil Projetos Locais';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SLA da fase = soma do SLA dos itens = CEIL(soma_horas / 8), mínimo 1
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE public.kanban_fases kf
SET sla_dias = GREATEST(1, CEIL(sub.total_horas / 8.0))::int
FROM (
  SELECT i.fase_id,
         SUM(COALESCE(i.horas_modelagem,0) + COALESCE(i.horas_documentacao,0) + COALESCE(i.horas_compatibilizacao,0)) AS total_horas
  FROM public.kanban_fase_checklist_itens i
  GROUP BY i.fase_id
) sub
JOIN public.kanban_fases kf2 ON kf2.id = sub.fase_id
JOIN public.kanbans k ON k.id = kf2.kanban_id
WHERE kf.id = sub.fase_id
  AND k.nome = 'Funil Projetos Locais'
  AND kf.slug LIKE 'pl_%'
  AND sub.total_horas > 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Verificação
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT kf.ordem, kf.slug, kf.sla_dias,
           COUNT(i.id) AS itens,
           COALESCE(SUM(COALESCE(i.horas_modelagem,0)+COALESCE(i.horas_documentacao,0)+COALESCE(i.horas_compatibilizacao,0)),0) AS horas
    FROM public.kanban_fases kf
    JOIN public.kanbans k ON k.id = kf.kanban_id
    LEFT JOIN public.kanban_fase_checklist_itens i ON i.fase_id = kf.id
    WHERE k.nome = 'Funil Projetos Locais' AND kf.slug LIKE 'pl_%'
    GROUP BY kf.ordem, kf.slug, kf.sla_dias
    ORDER BY kf.ordem
  LOOP
    RAISE NOTICE '448: % (%) → % itens, % h, SLA % d.u.', r.ordem, r.slug, r.itens, r.horas, r.sla_dias;
  END LOOP;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('448', 'funil_projetos_locais_fases_100_900')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
