-- 550: Funil Modelo Virtual — sobrescrever fases (10 fases definitivas).
-- Kanban já existe: 92d0033b-fd8c-432d-a089-e78c41a7cf48 (não recriar).
-- ATENÇÃO: kanban_cards.fase_id é ON DELETE CASCADE — apagar fases apagaria cards.
-- Por isso: inserir novas → remapar cards → apagar fases antigas (fora da lista nova).

-- ─── 1. Limpar checklist das fases atuais (respostas + itens) ─────────────────
DELETE FROM public.kanban_fase_checklist_respostas
WHERE item_id IN (
  SELECT i.id
  FROM public.kanban_fase_checklist_itens i
  JOIN public.kanban_fases f ON f.id = i.fase_id
  WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'::uuid
);

DELETE FROM public.kanban_fase_checklist_itens
WHERE fase_id IN (
  SELECT id FROM public.kanban_fases
  WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'::uuid
);

-- ─── 2. Inserir as 10 fases definitivas (só se o slug ainda não existir) ─────
INSERT INTO public.kanban_fases (
  kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
)
SELECT
  '92d0033b-fd8c-432d-a089-e78c41a7cf48'::uuid,
  v.nome,
  v.slug,
  v.ordem,
  v.sla_dias,
  v.sla_tipo,
  v.fase_conversao,
  true,
  NULL,
  '[]'::jsonb
FROM (
  VALUES
    (1,  'mv_modelagem_casa',   'Modelagem Casa',                5,    'uteis'::text, false),
    (2,  'mv_modelagem_infra',  'Modelagem e Infra',             5,    'uteis',       false),
    (3,  'mv_aguardar_boss',    'Aguardando Boss Panel',         21,   'corridos',    false),
    (4,  'mv_compat_estrutura', 'Compatibilização Moní x Boss',  2,    'uteis',       false),
    (5,  'mv_compat_infra',     'Compatibilização Infra',        2,    'uteis',       false),
    (6,  'mv_doc_fase1',        'Documentação 1ª fase',          2,    'uteis',       false),
    (7,  'mv_doc_fase2',        'Documentação 2ª fase',          2,    'uteis',       false),
    (8,  'mv_doc_fase3',        'Documentação 3ª fase',          4,    'uteis',       false),
    (9,  'mv_doc_fase4',        'Documentação 4ª fase',          8,    'uteis',       false),
    (10, 'mv_concluido',        'Concluído',                     NULL::integer, 'uteis', true)
) AS v(ordem, slug, nome, sla_dias, sla_tipo, fase_conversao)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_fases kf
  WHERE kf.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'::uuid
    AND kf.slug = v.slug
);

-- Garantir metadados corretos se algum slug já existia
UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = v.sla_tipo,
  fase_conversao = v.fase_conversao,
  ativo = true
FROM (
  VALUES
    (1,  'mv_modelagem_casa',   'Modelagem Casa',                5,    'uteis'::text, false),
    (2,  'mv_modelagem_infra',  'Modelagem e Infra',             5,    'uteis',       false),
    (3,  'mv_aguardar_boss',    'Aguardando Boss Panel',         21,   'corridos',    false),
    (4,  'mv_compat_estrutura', 'Compatibilização Moní x Boss',  2,    'uteis',       false),
    (5,  'mv_compat_infra',     'Compatibilização Infra',        2,    'uteis',       false),
    (6,  'mv_doc_fase1',        'Documentação 1ª fase',          2,    'uteis',       false),
    (7,  'mv_doc_fase2',        'Documentação 2ª fase',          2,    'uteis',       false),
    (8,  'mv_doc_fase3',        'Documentação 3ª fase',          4,    'uteis',       false),
    (9,  'mv_doc_fase4',        'Documentação 4ª fase',          8,    'uteis',       false),
    (10, 'mv_concluido',        'Concluído',                     NULL::integer, 'uteis', true)
) AS v(ordem, slug, nome, sla_dias, sla_tipo, fase_conversao)
WHERE kf.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'::uuid
  AND kf.slug = v.slug;

-- ─── 3. Remapear cards para a Fase 1 (preserva cards antes do DELETE) ────────
UPDATE public.kanban_cards
SET fase_id = (
  SELECT id FROM public.kanban_fases
  WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'::uuid
    AND slug = 'mv_modelagem_casa'
  LIMIT 1
)
WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'::uuid
  AND (
    fase_id IS NULL
    OR fase_id NOT IN (
      SELECT id FROM public.kanban_fases
      WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'::uuid
        AND slug IN (
          'mv_modelagem_casa', 'mv_modelagem_infra', 'mv_aguardar_boss',
          'mv_compat_estrutura', 'mv_compat_infra',
          'mv_doc_fase1', 'mv_doc_fase2', 'mv_doc_fase3', 'mv_doc_fase4',
          'mv_concluido'
        )
    )
  );

-- ─── 4. Apagar fases antigas (fora da lista definitiva) ───────────────────────
DELETE FROM public.kanban_fases
WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'::uuid
  AND slug NOT IN (
    'mv_modelagem_casa', 'mv_modelagem_infra', 'mv_aguardar_boss',
    'mv_compat_estrutura', 'mv_compat_infra',
    'mv_doc_fase1', 'mv_doc_fase2', 'mv_doc_fase3', 'mv_doc_fase4',
    'mv_concluido'
  );

NOTIFY pgrst, 'reload schema';
