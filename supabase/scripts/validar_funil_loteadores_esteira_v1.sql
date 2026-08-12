-- =============================================================================
-- Validação — Funil Loteadores esteira v1 (migrations 513–518)
-- =============================================================================
-- Rodar no SQL Editor do Supabase (DEV primeiro) DEPOIS das migrations.
--
-- Premissas:
--   • kanban_id = 3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c
--   • Coluna de posição em kanban_fases = `ordem` (alias `posicao` abaixo)
--   • Cards NÃO são deletados; 515 só MOVE + desativa fases
--
-- Opcional ANTES da migration: rode a seção 0 (baseline) e preserve o resultado
-- ou a tabela _validacao_loteadores_baseline. Sem baseline, a seção 1 reconstrói
-- o “antes” via kanban_historico (moves 515) + de-para conhecido.
-- =============================================================================

-- UUID canônico Funil Loteadores
-- \set kanban_id '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'

-- ---------------------------------------------------------------------------
-- 0) BASELINE (rodar ANTES das migrations 515+ — opcional)
-- ---------------------------------------------------------------------------
-- Descomente e execute uma vez antes de migrar:
/*
DROP TABLE IF EXISTS public._validacao_loteadores_baseline;
CREATE TABLE public._validacao_loteadores_baseline AS
SELECT
  c.id AS card_id,
  c.fase_id,
  f.slug AS fase_slug,
  f.nome AS fase_nome,
  f.ordem AS posicao,
  c.rede_loteador_id,
  c.arquivado,
  c.concluido,
  now() AS capturado_em
FROM public.kanban_cards c
LEFT JOIN public.kanban_fases f ON f.id = c.fase_id
WHERE c.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;

SELECT fase_slug, COUNT(*) AS cards
FROM public._validacao_loteadores_baseline
GROUP BY fase_slug
ORDER BY MIN(posicao) NULLS LAST, fase_slug;

SELECT COUNT(*) AS total_cards_baseline FROM public._validacao_loteadores_baseline;
*/

-- =============================================================================
-- 1) Contagem por fase: ANTES (reconstruído via histórico) vs DEPOIS
-- =============================================================================
-- Fonte do “antes”: reverse dos moves 515 em kanban_historico.
-- Se a migration 515 rodou sem trigger de histórico (service role / bulk),
-- cards_antes ≈ cards_depois — use a §0 (baseline) e a query 1c abaixo.
-- Nota: total_antes = total_depois sempre (mesmo conjunto de card_id).

WITH
kanban AS (
  SELECT '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid AS id
),
depara AS (
  SELECT * FROM (VALUES
    ('batalha_casas_moni_inc'::text, 'execucao_material_moni_inc'::text),
    ('r3_ajustes_finais_moni_inc',   'revisoes_moni_inc'),
    ('moni_capital_moni_inc',        'revisoes_moni_inc'),
    ('abertura_spe_moni_inc',        'cto_showroom_moni_inc'),
    ('abertura_spe_moni_inc',        'fechar_contrato_moni_inc')
  ) AS t(from_slug, to_slug)
),
fases AS (
  SELECT f.id, f.slug, f.nome, f.ordem, f.ativo
  FROM public.kanban_fases f
  JOIN kanban k ON f.kanban_id = k.id
),
cards_depois AS (
  SELECT
    c.id AS card_id,
    c.fase_id,
    f.slug AS fase_slug,
    f.nome AS fase_nome,
    f.ordem AS posicao
  FROM public.kanban_cards c
  JOIN kanban k ON c.kanban_id = k.id
  LEFT JOIN fases f ON f.id = c.fase_id
),
moves_515 AS (
  SELECT DISTINCT ON (h.card_id)
    h.card_id,
    fo.slug AS from_slug,
    fn.slug AS to_slug
  FROM public.kanban_historico h
  JOIN cards_depois cd ON cd.card_id = h.card_id
  CROSS JOIN LATERAL (
    SELECT NULLIF(trim(h.detalhe->>'fase_anterior_id'), '')::uuid AS fase_anterior_id,
           NULLIF(trim(h.detalhe->>'fase_nova_id'), '')::uuid AS fase_nova_id
  ) d
  LEFT JOIN fases fo ON fo.id = d.fase_anterior_id
  LEFT JOIN fases fn ON fn.id = d.fase_nova_id
  WHERE h.acao IN ('fase_avancada', 'fase_retrocedida')
    AND fo.slug IN (
      'batalha_casas_moni_inc',
      'r3_ajustes_finais_moni_inc',
      'moni_capital_moni_inc',
      'abertura_spe_moni_inc'
    )
    AND EXISTS (
      SELECT 1 FROM depara dp
      WHERE dp.from_slug = fo.slug AND dp.to_slug = fn.slug
    )
  ORDER BY h.card_id, h.criado_em DESC
),
cards_antes AS (
  SELECT
    cd.card_id,
    COALESCE(m.from_slug, cd.fase_slug) AS fase_slug_antes
  FROM cards_depois cd
  LEFT JOIN moves_515 m ON m.card_id = cd.card_id
),
agg_antes AS (
  SELECT fase_slug_antes AS slug, COUNT(*)::int AS cards_antes
  FROM cards_antes
  GROUP BY fase_slug_antes
),
agg_depois AS (
  SELECT fase_slug AS slug, COUNT(*)::int AS cards_depois
  FROM cards_depois
  GROUP BY fase_slug
),
totais AS (
  SELECT
    (SELECT COUNT(*) FROM cards_antes) AS total_antes,
    (SELECT COUNT(*) FROM cards_depois) AS total_depois,
    (SELECT COUNT(*) FROM moves_515) AS cards_com_move_515_no_historico
)
SELECT
  '1_contagem_por_fase' AS secao,
  COALESCE(a.slug, d.slug) AS slug,
  COALESCE(a.cards_antes, 0) AS cards_antes,
  COALESCE(d.cards_depois, 0) AS cards_depois,
  COALESCE(d.cards_depois, 0) - COALESCE(a.cards_antes, 0) AS delta,
  t.total_antes,
  t.total_depois,
  (t.total_antes = t.total_depois) AS totais_iguais,
  t.cards_com_move_515_no_historico,
  CASE
    WHEN t.cards_com_move_515_no_historico > 0
      THEN 'antes = reverse via kanban_historico (515)'
    ELSE 'sem moves 515 no histórico — compare com baseline (§0 / query 1c)'
  END AS nota_fonte_antes
FROM agg_antes a
FULL OUTER JOIN agg_depois d ON d.slug = a.slug
CROSS JOIN totais t
ORDER BY COALESCE(a.slug, d.slug);

SELECT
  '1b_resumo_totais' AS secao,
  (SELECT COUNT(*) FROM public.kanban_cards
   WHERE kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid) AS total_cards_depois,
  (
    SELECT COUNT(*) FROM public.kanban_historico h
    JOIN public.kanban_cards c ON c.id = h.card_id
    WHERE c.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
      AND h.acao = 'card_excluido'
  ) AS historico_card_excluido_loteadores;

-- 1c) Comparar com baseline (só se §0 foi executada). Se a tabela não existir, ignore o erro.
-- Descomente após criar _validacao_loteadores_baseline:
/*
SELECT
  '1c_baseline_vs_depois' AS secao,
  COALESCE(b.fase_slug, d.fase_slug) AS slug,
  COUNT(b.card_id)::int AS cards_baseline,
  COUNT(d.card_id)::int AS cards_depois,
  COUNT(d.card_id)::int - COUNT(b.card_id)::int AS delta
FROM public._validacao_loteadores_baseline b
FULL OUTER JOIN (
  SELECT c.id AS card_id, f.slug AS fase_slug
  FROM public.kanban_cards c
  LEFT JOIN public.kanban_fases f ON f.id = c.fase_id
  WHERE c.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
) d ON d.card_id = b.card_id
GROUP BY COALESCE(b.fase_slug, d.fase_slug)
ORDER BY 1;

SELECT
  '1c_totais' AS secao,
  (SELECT COUNT(*) FROM public._validacao_loteadores_baseline) AS total_baseline,
  (SELECT COUNT(*) FROM public.kanban_cards
   WHERE kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid) AS total_depois,
  (
    (SELECT COUNT(*) FROM public._validacao_loteadores_baseline)
    = (SELECT COUNT(*) FROM public.kanban_cards
       WHERE kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid)
  ) AS totais_iguais;
*/

-- =============================================================================
-- 2) Cards ainda em fases inativas (ativo = false) — deve estar VAZIO
-- =============================================================================

SELECT
  '2_cards_em_fase_inativa' AS secao,
  c.id AS card_id,
  c.titulo,
  f.slug AS fase_slug,
  f.nome AS fase_nome,
  f.ordem AS posicao,
  f.ativo,
  c.arquivado,
  c.concluido,
  c.status
FROM public.kanban_cards c
JOIN public.kanban_fases f ON f.id = c.fase_id
WHERE c.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
  AND f.ativo IS DISTINCT FROM true
ORDER BY f.ordem, c.titulo;

SELECT
  '2b_check_vazio' AS secao,
  COUNT(*)::int AS cards_em_fase_inativa,
  (COUNT(*) = 0) AS ok_lista_vazia
FROM public.kanban_cards c
JOIN public.kanban_fases f ON f.id = c.fase_id
WHERE c.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
  AND f.ativo IS DISTINCT FROM true;

-- =============================================================================
-- 3) Cards sem rede_loteador_id — revisão manual
-- =============================================================================

SELECT
  '3_cards_sem_loteador' AS secao,
  c.id AS card_id,
  c.titulo,
  f.slug AS fase_slug,
  f.nome AS fase_nome,
  f.ordem AS posicao,
  c.arquivado,
  c.concluido,
  c.created_at
FROM public.kanban_cards c
LEFT JOIN public.kanban_fases f ON f.id = c.fase_id
WHERE c.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
  AND c.rede_loteador_id IS NULL
ORDER BY f.ordem NULLS LAST, c.created_at DESC;

SELECT
  '3b_resumo_sem_loteador' AS secao,
  COUNT(*)::int AS sem_rede_loteador_id,
  COUNT(*) FILTER (WHERE NOT COALESCE(c.arquivado, false) AND NOT COALESCE(c.concluido, false))::int
    AS sem_loteador_ativos
FROM public.kanban_cards c
WHERE c.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
  AND c.rede_loteador_id IS NULL;

-- =============================================================================
-- 4) Checklists em fases desativadas — respostas preservadas / órfãos
-- =============================================================================

-- 4a) Itens + respostas ainda ligados às 4 fases desativadas (dados NÃO devem sumir)
SELECT
  '4a_checklist_fases_inativas' AS secao,
  f.slug AS fase_slug,
  f.nome AS fase_nome,
  COUNT(DISTINCT i.id)::int AS itens,
  COUNT(r.id)::int AS respostas,
  COUNT(DISTINCT r.card_id)::int AS cards_com_resposta
FROM public.kanban_fases f
LEFT JOIN public.kanban_fase_checklist_itens i ON i.fase_id = f.id
LEFT JOIN public.kanban_fase_checklist_respostas r ON r.item_id = i.id
WHERE f.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
  AND f.slug IN (
    'batalha_casas_moni_inc',
    'r3_ajustes_finais_moni_inc',
    'moni_capital_moni_inc',
    'abertura_spe_moni_inc'
  )
GROUP BY f.slug, f.nome, f.ordem
ORDER BY f.ordem;

-- 4b) Respostas órfãs (item_id sem item) em cards do funil — deve ser 0
SELECT
  '4b_respostas_orfas' AS secao,
  r.id AS resposta_id,
  r.card_id,
  r.item_id,
  c.titulo
FROM public.kanban_fase_checklist_respostas r
JOIN public.kanban_cards c ON c.id = r.card_id
WHERE c.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i WHERE i.id = r.item_id
  )
ORDER BY c.titulo
LIMIT 200;

SELECT
  '4b_check_orfas' AS secao,
  COUNT(*)::int AS respostas_orfas,
  (COUNT(*) = 0) AS ok_sem_orfas
FROM public.kanban_fase_checklist_respostas r
JOIN public.kanban_cards c ON c.id = r.card_id
WHERE c.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i WHERE i.id = r.item_id
  );

-- 4c) Cards que estavam nas fases legado (histórico) e ainda têm respostas nessas fases
--     (esperado: respostas permanecem nos itens da fase antiga; não são apagadas)
SELECT
  '4c_cards_movidos_com_checklist_origem' AS secao,
  c.id AS card_id,
  c.titulo,
  fo.slug AS fase_origem_slug,
  fn.slug AS fase_atual_slug,
  COUNT(r.id)::int AS respostas_na_origem
FROM public.kanban_cards c
JOIN public.kanban_fases fn ON fn.id = c.fase_id
JOIN public.kanban_historico h ON h.card_id = c.id
CROSS JOIN LATERAL (
  SELECT NULLIF(trim(h.detalhe->>'fase_anterior_id'), '')::uuid AS fase_anterior_id,
         NULLIF(trim(h.detalhe->>'fase_nova_id'), '')::uuid AS fase_nova_id
) d
JOIN public.kanban_fases fo ON fo.id = d.fase_anterior_id
LEFT JOIN public.kanban_fase_checklist_itens i ON i.fase_id = fo.id
LEFT JOIN public.kanban_fase_checklist_respostas r
  ON r.item_id = i.id AND r.card_id = c.id
WHERE c.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
  AND h.acao IN ('fase_avancada', 'fase_retrocedida')
  AND fo.slug IN (
    'batalha_casas_moni_inc',
    'r3_ajustes_finais_moni_inc',
    'moni_capital_moni_inc',
    'abertura_spe_moni_inc'
  )
GROUP BY c.id, c.titulo, fo.slug, fn.slug
HAVING COUNT(r.id) > 0
ORDER BY respostas_na_origem DESC, c.titulo
LIMIT 100;

-- 4d) Fases novas (Prompt 7): itens de checklist esperados (Gbox = 0 itens)
SELECT
  '4d_checklist_fases_novas' AS secao,
  f.slug,
  f.nome,
  f.ordem AS posicao,
  COUNT(i.id)::int AS qtd_itens,
  CASE f.slug
    WHEN 'acoplamento_gbox_moni_inc' THEN (COUNT(i.id) = 0)
    WHEN 'nda_moni_inc' THEN (COUNT(i.id) >= 3)
    WHEN 'opcao_moni_inc' THEN (COUNT(i.id) >= 3)
    WHEN 'aguardando_ficha_moni_inc' THEN (COUNT(i.id) >= 6)
    WHEN 'validacao_moni_inc' THEN (COUNT(i.id) >= 2)
    WHEN 'revisoes_pos_comite_moni_inc' THEN (COUNT(i.id) >= 3)
    WHEN 'cto_precedentes_moni_inc' THEN (COUNT(i.id) >= 3)
    WHEN 'passagem_waysers_moni_inc' THEN (COUNT(i.id) >= 1)
    ELSE true
  END AS ok_checklist
FROM public.kanban_fases f
LEFT JOIN public.kanban_fase_checklist_itens i
  ON i.fase_id = f.id
 AND COALESCE((i.config_json->>'oculto_ui')::boolean, false) IS NOT TRUE
WHERE f.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
  AND f.slug IN (
    'nda_moni_inc',
    'opcao_moni_inc',
    'aguardando_ficha_moni_inc',
    'validacao_moni_inc',
    'acoplamento_gbox_moni_inc',
    'revisoes_pos_comite_moni_inc',
    'cto_precedentes_moni_inc',
    'passagem_waysers_moni_inc'
  )
GROUP BY f.slug, f.nome, f.ordem
ORDER BY f.ordem;

-- =============================================================================
-- 5) Fases novas com 0 cards — esperado; confirme que existem e estão ativas
-- =============================================================================

SELECT
  '5_fases_novas' AS secao,
  f.slug,
  f.nome,
  f.ordem AS posicao,
  f.sla_dias,
  f.ativo,
  COUNT(c.id)::int AS cards,
  (f.ativo IS TRUE) AS ok_ativa,
  (COUNT(c.id) = 0) AS zero_cards_esperado_ou_ok
FROM public.kanban_fases f
LEFT JOIN public.kanban_cards c
  ON c.fase_id = f.id AND c.kanban_id = f.kanban_id
WHERE f.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
  AND f.slug IN (
    'nda_moni_inc',
    'opcao_moni_inc',
    'aguardando_ficha_moni_inc',
    'validacao_moni_inc',
    'acoplamento_gbox_moni_inc',
    'revisoes_pos_comite_moni_inc',
    'cto_precedentes_moni_inc',
    'passagem_waysers_moni_inc'
  )
GROUP BY f.id, f.slug, f.nome, f.ordem, f.sla_dias, f.ativo
ORDER BY f.ordem;

SELECT
  '5b_check_8_fases_novas' AS secao,
  COUNT(*)::int AS fases_novas_encontradas,
  (COUNT(*) = 8) AS ok_oito_fases,
  COUNT(*) FILTER (WHERE f.ativo IS TRUE)::int AS ativas,
  (COUNT(*) FILTER (WHERE f.ativo IS TRUE) = 8) AS ok_todas_ativas
FROM public.kanban_fases f
WHERE f.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
  AND f.slug IN (
    'nda_moni_inc',
    'opcao_moni_inc',
    'aguardando_ficha_moni_inc',
    'validacao_moni_inc',
    'acoplamento_gbox_moni_inc',
    'revisoes_pos_comite_moni_inc',
    'cto_precedentes_moni_inc',
    'passagem_waysers_moni_inc'
  );

-- =============================================================================
-- 6) Ordem das fases (ordem AS posicao) — 19 ativas + 4 inativas
-- =============================================================================

SELECT
  '6_ordem_fases' AS secao,
  f.slug,
  f.nome,
  f.ordem AS posicao,
  f.sla_dias,
  f.ativo
FROM public.kanban_fases f
WHERE f.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
ORDER BY f.ordem, f.slug;

SELECT
  '6b_check_contagens_fases' AS secao,
  COUNT(*) FILTER (WHERE ativo IS TRUE)::int AS fases_ativas,
  COUNT(*) FILTER (WHERE ativo IS DISTINCT FROM true)::int AS fases_inativas,
  COUNT(*)::int AS total_fases,
  (COUNT(*) FILTER (WHERE ativo IS TRUE) = 19) AS ok_19_ativas,
  (COUNT(*) FILTER (WHERE ativo IS DISTINCT FROM true) >= 4) AS ok_pelo_menos_4_inativas,
  (
    SELECT COUNT(*) = 4
    FROM public.kanban_fases x
    WHERE x.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
      AND x.slug IN (
        'batalha_casas_moni_inc',
        'r3_ajustes_finais_moni_inc',
        'moni_capital_moni_inc',
        'abertura_spe_moni_inc'
      )
      AND x.ativo IS DISTINCT FROM true
  ) AS ok_4_legado_inativas
FROM public.kanban_fases f
WHERE f.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;

-- Sequência canônica das 19 ativas (slug na ordem 1–19)
SELECT
  '6c_sequencia_canonica' AS secao,
  expected.ordem AS posicao,
  f.slug AS slug_atual,
  f.nome,
  f.sla_dias,
  f.ativo,
  expected.slug AS slug_esperado,
  CASE
    WHEN expected.ordem = 17 THEN
      (f.slug IN ('cto_showroom_moni_inc', 'fechar_contrato_moni_inc') AND f.ativo IS TRUE)
    ELSE
      (f.slug = expected.slug AND f.ativo IS TRUE)
  END AS ok_slot
FROM (
  VALUES
    (1,  'primeiro_contato_moni_inc'),
    (2,  'r1_conceito_moni_inc'),
    (3,  'nda_moni_inc'),
    (4,  'opcao_moni_inc'),
    (5,  'aguardando_ficha_moni_inc'),
    (6,  'viabilidade_moni_inc'),
    (7,  'acoplamento_moni_inc'),
    (8,  'execucao_material_moni_inc'),
    (9,  'validacao_moni_inc'),
    (10, 'r2_plano_teorico_moni_inc'),
    (11, 'revisoes_moni_inc'),
    (12, 'acoplamento_gbox_moni_inc'),
    (13, 'comite_moni_inc'),
    (14, 'revisoes_pos_comite_moni_inc'),
    (15, 'cto_precedentes_moni_inc'),
    (16, 'diligencia_moni_inc'),
    (17, 'cto_showroom_moni_inc'),
    (18, 'passagem_waysers_moni_inc'),
    (19, 'contrato_parceria_moni_inc')
) AS expected(ordem, slug)
LEFT JOIN public.kanban_fases f
  ON f.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
 AND f.ordem = expected.ordem
ORDER BY expected.ordem;

-- =============================================================================
-- 7) Painel de checks (OK / FALHA) — leia esta query no final
-- =============================================================================

SELECT * FROM (
  SELECT
    'cards_em_fase_inativa = 0' AS check_nome,
    (
      SELECT COUNT(*) = 0
      FROM public.kanban_cards c
      JOIN public.kanban_fases f ON f.id = c.fase_id
      WHERE c.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
        AND f.ativo IS DISTINCT FROM true
    ) AS ok
  UNION ALL
  SELECT
    '19 fases ativas',
    (
      SELECT COUNT(*) = 19
      FROM public.kanban_fases
      WHERE kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
        AND ativo IS TRUE
    )
  UNION ALL
  SELECT
    '4 fases legado inativas',
    (
      SELECT COUNT(*) = 4
      FROM public.kanban_fases
      WHERE kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
        AND slug IN (
          'batalha_casas_moni_inc',
          'r3_ajustes_finais_moni_inc',
          'moni_capital_moni_inc',
          'abertura_spe_moni_inc'
        )
        AND ativo IS DISTINCT FROM true
    )
  UNION ALL
  SELECT
    '8 fases novas existem e ativas',
    (
      SELECT COUNT(*) = 8
      FROM public.kanban_fases
      WHERE kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
        AND ativo IS TRUE
        AND slug IN (
          'nda_moni_inc',
          'opcao_moni_inc',
          'aguardando_ficha_moni_inc',
          'validacao_moni_inc',
          'acoplamento_gbox_moni_inc',
          'revisoes_pos_comite_moni_inc',
          'cto_precedentes_moni_inc',
          'passagem_waysers_moni_inc'
        )
    )
  UNION ALL
  SELECT
    'sequencia canônica 1–19 (slug por ordem)',
    (
      SELECT bool_and(
        CASE
          WHEN e.ordem = 17 THEN
            f.slug IN ('cto_showroom_moni_inc', 'fechar_contrato_moni_inc') AND f.ativo IS TRUE
          ELSE
            f.slug = e.slug AND f.ativo IS TRUE
        END
      )
      FROM (
        VALUES
          (1,  'primeiro_contato_moni_inc'),
          (2,  'r1_conceito_moni_inc'),
          (3,  'nda_moni_inc'),
          (4,  'opcao_moni_inc'),
          (5,  'aguardando_ficha_moni_inc'),
          (6,  'viabilidade_moni_inc'),
          (7,  'acoplamento_moni_inc'),
          (8,  'execucao_material_moni_inc'),
          (9,  'validacao_moni_inc'),
          (10, 'r2_plano_teorico_moni_inc'),
          (11, 'revisoes_moni_inc'),
          (12, 'acoplamento_gbox_moni_inc'),
          (13, 'comite_moni_inc'),
          (14, 'revisoes_pos_comite_moni_inc'),
          (15, 'cto_precedentes_moni_inc'),
          (16, 'diligencia_moni_inc'),
          (17, 'cto_showroom_moni_inc'),
          (18, 'passagem_waysers_moni_inc'),
          (19, 'contrato_parceria_moni_inc')
      ) AS e(ordem, slug)
      LEFT JOIN public.kanban_fases f
        ON f.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
       AND f.ordem = e.ordem
    )
  UNION ALL
  SELECT
    'sem respostas órfãs de checklist',
    (
      SELECT COUNT(*) = 0
      FROM public.kanban_fase_checklist_respostas r
      JOIN public.kanban_cards c ON c.id = r.card_id
      WHERE c.kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
        AND NOT EXISTS (
          SELECT 1 FROM public.kanban_fase_checklist_itens i WHERE i.id = r.item_id
        )
    )
  UNION ALL
  SELECT
    'slug cto_showroom (ou fechar_contrato legado) ativo na ordem 17',
    (
      SELECT COUNT(*) = 1
      FROM public.kanban_fases
      WHERE kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
        AND ordem = 17
        AND ativo IS TRUE
        AND slug IN ('cto_showroom_moni_inc', 'fechar_contrato_moni_inc')
    )
) AS checks
ORDER BY check_nome;

-- Fim. Interpretação:
--   • Seção 7: todas as linhas ok = true (baseline pode ser NULL se não rodou §0)
--   • Seção 2: 0 linhas
--   • Seção 3: listar e tratar manualmente
--   • Seção 5: 8 fases novas presentes (0 cards é OK)
--   • Nota: coluna real é `ordem`; consultas usam alias `posicao` como no prompt.
