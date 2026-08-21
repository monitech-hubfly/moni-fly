-- =============================================================================
-- cleanup_test_chamados_renumerar.sql
-- Remove chamados/atividades de teste e renumera #0001..N sem buracos.
--
-- ⚠️  IRREVERSÍVEL: exclusão física de linhas e dependentes (CASCADE).
-- ⚠️  NÃO executar em produção sem backup e revisão do bloco PREVIEW.
-- ⚠️  Rodar manualmente no Supabase SQL Editor (DEV/staging primeiro).
--
-- Dependências removidas automaticamente ao apagar kanban_atividades:
--   sirene_topicos (interacao_id), sirene_notificacoes (interacao_id),
--   chamado_anexos, etc.
-- Ao apagar sirene_chamados:
--   sirene_topicos (chamado_id), sirene_anexos, sirene_mensagens,
--   sirene_pericia_chamados, sirene_notificacoes (chamado_id),
--   sirene_pastelaria_vinculos, etc.
-- kanban_atividades.sirene_chamado_id → ON DELETE SET NULL (por isso apagamos ka antes).
--
-- Alvos (screenshots / lista do time):
--   Chamados HDM: #0003 trhhfhfh, #0004 Ferramenta Bombeiro inativa
--   Atividades: #0409 fazer 3, #0348 gfbf, #0337 fazer, #0376 fazer,
--              #0395 fazer 1, #0299 teste 1, #0295 teste
-- =============================================================================

-- ─── 0) PREVIEW (somente leitura) ───────────────────────────────────────────
-- Execute até aqui primeiro; confira ids/uuids antes do DELETE.

WITH titulos_exatos AS (
  SELECT unnest(ARRAY[
    'trhhfhfh',
    'Ferramenta Bombeiro inativa',
    'fazer 3',
    'gfbf',
    'fazer',
    'fazer 1',
    'teste 1',
    'teste'
  ]::text[]) AS titulo
),
numeros_alvo AS (
  SELECT unnest(ARRAY[3, 4, 295, 299, 337, 348, 376, 395, 409]::int[]) AS numero
),
ka_por_numero AS (
  SELECT ka.id, ka.numero, ka.titulo, ka.descricao, ka.tipo, ka.origem, ka.sirene_chamado_id
  FROM public.kanban_atividades ka
  JOIN numeros_alvo n ON n.numero = ka.numero
),
ka_por_titulo AS (
  SELECT ka.id, ka.numero, ka.titulo, ka.descricao, ka.tipo, ka.origem, ka.sirene_chamado_id
  FROM public.kanban_atividades ka
  CROSS JOIN titulos_exatos te
  WHERE lower(btrim(COALESCE(ka.titulo, ''))) = lower(btrim(te.titulo))
     OR lower(btrim(COALESCE(ka.descricao, ''))) = lower(btrim(te.titulo))
),
sc_por_numero AS (
  SELECT sc.id, sc.numero, sc.incendio, sc.tema, sc.trava
  FROM public.sirene_chamados sc
  JOIN numeros_alvo n ON n.numero = sc.numero
),
sc_por_titulo AS (
  SELECT sc.id, sc.numero, sc.incendio, sc.tema, sc.trava
  FROM public.sirene_chamados sc
  CROSS JOIN titulos_exatos te
  WHERE lower(btrim(COALESCE(sc.incendio, ''))) = lower(btrim(te.titulo))
     OR lower(btrim(COALESCE(sc.tema, ''))) = lower(btrim(te.titulo))
),
ka_alvo AS (
  SELECT DISTINCT id, numero, titulo, origem, sirene_chamado_id, 'numero_ou_titulo' AS motivo
  FROM (
    SELECT id, numero, titulo, origem, sirene_chamado_id FROM ka_por_numero
    UNION ALL
    SELECT id, numero, titulo, origem, sirene_chamado_id FROM ka_por_titulo
  ) u
),
sc_alvo AS (
  SELECT DISTINCT id, numero, incendio, trava, 'numero_ou_titulo' AS motivo
  FROM (
    SELECT id, numero, incendio, trava FROM sc_por_numero
    UNION ALL
    SELECT id, numero, incendio, trava FROM sc_por_titulo
  ) u
)
SELECT 'kanban_atividades' AS tabela, ka.id::text, ka.numero, ka.titulo, ka.origem, ka.motivo
FROM ka_alvo ka
UNION ALL
SELECT 'sirene_chamados', sc.id::text, sc.numero, sc.incendio, NULL, sc.motivo
FROM sc_alvo sc
ORDER BY 1, 3;

-- Contagem de dependentes (preview)
WITH titulos_exatos AS (
  SELECT unnest(ARRAY[
    'trhhfhfh', 'Ferramenta Bombeiro inativa', 'fazer 3', 'gfbf', 'fazer',
    'fazer 1', 'teste 1', 'teste'
  ]::text[]) AS titulo
),
numeros_alvo AS (
  SELECT unnest(ARRAY[3, 4, 295, 299, 337, 348, 376, 395, 409]::int[]) AS numero
),
ka_ids AS (
  SELECT DISTINCT ka.id
  FROM public.kanban_atividades ka
  WHERE ka.numero IN (SELECT numero FROM numeros_alvo)
     OR EXISTS (
       SELECT 1 FROM titulos_exatos te
       WHERE lower(btrim(COALESCE(ka.titulo, ''))) = lower(btrim(te.titulo))
          OR lower(btrim(COALESCE(ka.descricao, ''))) = lower(btrim(te.titulo))
     )
),
sc_ids AS (
  SELECT DISTINCT sc.id
  FROM public.sirene_chamados sc
  WHERE sc.numero IN (SELECT numero FROM numeros_alvo)
     OR EXISTS (
       SELECT 1 FROM titulos_exatos te
       WHERE lower(btrim(COALESCE(sc.incendio, ''))) = lower(btrim(te.titulo))
          OR lower(btrim(COALESCE(sc.tema, ''))) = lower(btrim(te.titulo))
     )
  UNION
  SELECT DISTINCT ka.sirene_chamado_id
  FROM public.kanban_atividades ka
  JOIN ka_ids k ON k.id = ka.id
  WHERE ka.sirene_chamado_id IS NOT NULL
)
SELECT 'sirene_topicos (interacao)' AS rel, count(*)::bigint
FROM public.sirene_topicos st
JOIN ka_ids k ON k.id = st.interacao_id
UNION ALL
SELECT 'sirene_topicos (chamado)', count(*)::bigint
FROM public.sirene_topicos st
JOIN sc_ids s ON s.id = st.chamado_id
UNION ALL
SELECT 'sirene_notificacoes (interacao)', count(*)::bigint
FROM public.sirene_notificacoes sn
JOIN ka_ids k ON k.id = sn.interacao_id
UNION ALL
SELECT 'chamado_anexos', count(*)::bigint
FROM public.chamado_anexos ca
JOIN ka_ids k ON k.id = ca.chamado_id
UNION ALL
SELECT 'sirene_pastelaria_vinculos', count(*)::bigint
FROM public.sirene_pastelaria_vinculos v
JOIN sc_ids s ON s.id = v.sirene_chamado_id;


-- ─── 1) EXCLUSÃO + RENUMERAÇÃO (transação) ──────────────────────────────────
-- Descomente o bloco abaixo SOMENTE após validar o PREVIEW.

/*
BEGIN;

CREATE TEMP TABLE _cleanup_ka_alvo ON COMMIT DROP AS
WITH titulos_exatos AS (
  SELECT unnest(ARRAY[
    'trhhfhfh', 'Ferramenta Bombeiro inativa', 'fazer 3', 'gfbf', 'fazer',
    'fazer 1', 'teste 1', 'teste'
  ]::text[]) AS titulo
),
numeros_alvo AS (
  SELECT unnest(ARRAY[3, 4, 295, 299, 337, 348, 376, 395, 409]::int[]) AS numero
)
SELECT DISTINCT ka.id
FROM public.kanban_atividades ka
WHERE ka.numero IN (SELECT numero FROM numeros_alvo)
   OR EXISTS (
     SELECT 1 FROM titulos_exatos te
     WHERE lower(btrim(COALESCE(ka.titulo, ''))) = lower(btrim(te.titulo))
        OR lower(btrim(COALESCE(ka.descricao, ''))) = lower(btrim(te.titulo))
   );

CREATE TEMP TABLE _cleanup_sc_alvo ON COMMIT DROP AS
WITH titulos_exatos AS (
  SELECT unnest(ARRAY[
    'trhhfhfh', 'Ferramenta Bombeiro inativa', 'fazer 3', 'gfbf', 'fazer',
    'fazer 1', 'teste 1', 'teste'
  ]::text[]) AS titulo
),
numeros_alvo AS (
  SELECT unnest(ARRAY[3, 4, 295, 299, 337, 348, 376, 395, 409]::int[]) AS numero
)
SELECT DISTINCT sc.id
FROM public.sirene_chamados sc
WHERE sc.numero IN (SELECT numero FROM numeros_alvo)
   OR EXISTS (
     SELECT 1 FROM titulos_exatos te
     WHERE lower(btrim(COALESCE(sc.incendio, ''))) = lower(btrim(te.titulo))
        OR lower(btrim(COALESCE(sc.tema, ''))) = lower(btrim(te.titulo))
   )
UNION
SELECT DISTINCT ka.sirene_chamado_id
FROM public.kanban_atividades ka
JOIN _cleanup_ka_alvo k ON k.id = ka.id
WHERE ka.sirene_chamado_id IS NOT NULL;

-- 1a) Interações kanban (CASCADE em tópicos/notificações/anexos por interacao_id)
DELETE FROM public.kanban_atividades ka
WHERE ka.id IN (SELECT id FROM _cleanup_ka_alvo);

-- 1b) Chamados Sirene órfãos ou identificados diretamente
DELETE FROM public.sirene_chamados sc
WHERE sc.id IN (SELECT id FROM _cleanup_sc_alvo);

-- ─── 2) Renumeração global (sem buracos) ───────────────────────────────────
-- Estratégia:
--   1) sirene_chamados → 1..N (ordem: numero antigo, data_abertura, id)
--   2) kanban_atividades vinculadas (sirene_chamado_id) espelham sc.numero
--   3) ka órfãs com numero (sem sirene_chamado_id) → N+1..M
-- Fase negativa em cada passo evita violar UNIQUE durante o UPDATE.

-- 2A) sirene_chamados (fonte da verdade para chamados Sirene)
WITH ordem AS (
  SELECT
    sc.id,
    row_number() OVER (
      ORDER BY sc.numero NULLS LAST, sc.data_abertura NULLS LAST, sc.created_at NULLS LAST, sc.id
    ) AS novo
  FROM public.sirene_chamados sc
)
UPDATE public.sirene_chamados sc
SET numero = -ordem.novo
FROM ordem
WHERE sc.id = ordem.id;

WITH ordem AS (
  SELECT
    sc.id,
    row_number() OVER (
      ORDER BY sc.numero ASC, sc.data_abertura NULLS LAST, sc.created_at NULLS LAST, sc.id
    ) AS novo
  FROM public.sirene_chamados sc
)
UPDATE public.sirene_chamados sc
SET numero = ordem.novo
FROM ordem
WHERE sc.id = ordem.id;

-- 2B) Interações vinculadas espelham o chamado
UPDATE public.kanban_atividades ka
SET numero = sc.numero
FROM public.sirene_chamados sc
WHERE ka.sirene_chamado_id = sc.id;

-- 2C) Interações com # mas sem sirene_chamado_id (ex.: funil nativo com numero)
WITH base AS (
  SELECT COALESCE((SELECT MAX(numero) FROM public.sirene_chamados), 0) AS offset_n
),
ordem AS (
  SELECT
    ka.id,
    base.offset_n + row_number() OVER (
      ORDER BY ka.numero NULLS LAST, ka.created_at NULLS LAST, ka.id
    ) AS novo
  FROM public.kanban_atividades ka
  CROSS JOIN base
  WHERE ka.numero IS NOT NULL
    AND ka.sirene_chamado_id IS NULL
)
UPDATE public.kanban_atividades ka
SET numero = -ordem.novo
FROM ordem
WHERE ka.id = ordem.id;

WITH base AS (
  SELECT COALESCE((SELECT MAX(numero) FROM public.sirene_chamados), 0) AS offset_n
),
ordem AS (
  SELECT
    ka.id,
    base.offset_n + row_number() OVER (
      ORDER BY ka.numero ASC, ka.created_at NULLS LAST, ka.id
    ) AS novo
  FROM public.kanban_atividades ka
  CROSS JOIN base
  WHERE ka.numero IS NOT NULL
    AND ka.sirene_chamado_id IS NULL
)
UPDATE public.kanban_atividades ka
SET numero = ordem.novo
FROM ordem
WHERE ka.id = ordem.id;

-- 2D) Sequência para próximos inserts
SELECT setval(
  'public.sirene_numero_seq',
  GREATEST(
    COALESCE((SELECT MAX(numero) FROM public.sirene_chamados), 0),
    COALESCE((SELECT MAX(numero) FROM public.kanban_atividades WHERE numero IS NOT NULL), 0),
    1
  )
);

COMMIT;
*/

-- ─── 3) Pós-execução (sanidade) ─────────────────────────────────────────────
-- SELECT MAX(numero) AS max_sc FROM public.sirene_chamados;
-- SELECT MAX(numero) AS max_ka FROM public.kanban_atividades WHERE numero IS NOT NULL;
-- SELECT last_value FROM public.sirene_numero_seq;
-- SELECT numero, count(*) FROM public.sirene_chamados GROUP BY numero HAVING count(*) > 1;
-- SELECT numero, count(*) FROM public.kanban_atividades WHERE numero IS NOT NULL GROUP BY numero HAVING count(*) > 1;
