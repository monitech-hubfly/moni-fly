-- =============================================================================
-- Remover chamados de teste e renumerar sequência global (#0001…)
-- =============================================================================
-- Rodar MANUALMENTE no Supabase SQL Editor (não é migration automática).
--
-- Numeração:
--   sirene_chamados.numero  → sequência sirene_numero_seq
--   kanban_atividades.numero → espelho (origem=sirene / sirene_chamado_id)
--   UI: formatChamadoNumero → #0001 (src/lib/kanban/chamado-numero.ts)
--   View v_atividades_unificadas.chamado_numero
--
-- Alvos (screenshots Sirene / Funil Portfólio, jun/2026):
--   #0003  trhhfhfh                    (Sem trava / HDM)
--   #0004  Ferramenta Bombeiro inativa  (provável teste — ver nota abaixo)
--   #0295  teste
--   #0299  teste 1
--   #0337  fazer
--   #0348  gfbf
--   #0376  fazer
--   #0395  fazer 1
--   #0409  fazer 3
--
-- Ordem de delete (igual app deletarChamado):
--   1) kanban_atividades (CASCADE em sirene_topicos.interacao_id, anexos, etc.)
--   2) sirene_chamados (CASCADE tópicos/mensagens/vínculos pastelaria)
--
-- Idempotência: se os numeros já foram removidos, DELETE afeta 0 linhas;
--   a renumeração ainda compacta 1..N (seguro repetir após sucesso).
-- =============================================================================

-- ─── 1) PREVIEW — rodar só até aqui na primeira vez ─────────────────────────

-- 1a) Chamados alvo por numero explícito
SELECT
  sc.id,
  sc.numero,
  LPAD(sc.numero::text, 4, '0') AS numero_fmt,
  sc.incendio,
  sc.tipo,
  sc.trava,
  sc.arquivado,
  sc.created_at,
  sc.card_id,
  sc.card_kanban_nome
FROM public.sirene_chamados sc
WHERE sc.numero IN (
  3,    -- trhhfhfh
  4,    -- Ferramenta Bombeiro inativa (comente a linha no bloco EXEC se não quiser remover)
  295,  -- teste
  299,  -- teste 1
  337,  -- fazer
  348,  -- gfbf
  376,  -- fazer
  395,  -- fazer 1
  409   -- fazer 3
)
ORDER BY sc.numero;

-- 1b) Interações kanban ligadas
SELECT
  ka.id AS interacao_id,
  ka.numero,
  ka.origem,
  ka.titulo,
  ka.sirene_chamado_id,
  sc.numero AS sirene_numero,
  sc.incendio
FROM public.kanban_atividades ka
LEFT JOIN public.sirene_chamados sc ON sc.id = ka.sirene_chamado_id
WHERE ka.sirene_chamado_id IN (
  SELECT id FROM public.sirene_chamados
  WHERE numero IN (3, 4, 295, 299, 337, 348, 376, 395, 409)
)
   OR (ka.origem = 'sirene' AND ka.numero IN (3, 4, 295, 299, 337, 348, 376, 395, 409))
ORDER BY COALESCE(ka.numero, sc.numero);

-- 1c) Descoberta extra por padrão de título (não deleta sozinho — conferência)
SELECT
  sc.id,
  sc.numero,
  sc.incendio,
  sc.created_at
FROM public.sirene_chamados sc
WHERE sc.numero NOT IN (3, 4, 295, 299, 337, 348, 376, 395, 409)
  AND (
    lower(trim(sc.incendio)) IN ('trhhfhfh', 'gfbf')
    OR lower(trim(sc.incendio)) ~ '^(teste|fazer)'
    OR lower(trim(sc.incendio)) ~ '^fazer [0-9]'
    OR lower(trim(sc.incendio)) LIKE 'ferramenta bombeiro inativa%'
  )
ORDER BY sc.numero;

-- 1d) Estado atual da sequência
SELECT
  last_value AS seq_last_value,
  is_called AS seq_is_called
FROM public.sirene_numero_seq;

SELECT
  COUNT(*) AS total_chamados,
  MIN(numero) AS min_numero,
  MAX(numero) AS max_numero
FROM public.sirene_chamados;

-- ─── 2) EXECUÇÃO — após validar o preview ───────────────────────────────────
-- Troque ROLLBACK por COMMIT quando estiver satisfeito.
-- (Em alguns editores, rode BEGIN…COMMIT em uma única execução.)

BEGIN;

CREATE TEMP TABLE _remover_chamados ON COMMIT DROP AS
SELECT
  sc.id,
  sc.numero,
  sc.incendio,
  sc.created_at
FROM public.sirene_chamados sc
WHERE sc.numero IN (
  3,
  4,    -- ← remova esta linha se #0004 não for teste
  295,
  299,
  337,
  348,
  376,
  395,
  409
);

-- Conferência dentro da transação
SELECT 'a_remover' AS etapa, id, numero, incendio FROM _remover_chamados ORDER BY numero;

-- 2a) kanban_atividades primeiro (espelho + CASCADE em tópicos por interacao_id)
DELETE FROM public.kanban_atividades ka
WHERE ka.sirene_chamado_id IN (SELECT id FROM _remover_chamados)
   OR (
     ka.origem = 'sirene'
     AND ka.numero IN (SELECT numero FROM _remover_chamados)
   );

-- 2b) sirene_chamados
DELETE FROM public.sirene_chamados sc
WHERE sc.id IN (SELECT id FROM _remover_chamados);

-- Liberar índice UNIQUE em kanban_atividades.numero (só linhas Sirene / vinculadas)
UPDATE public.kanban_atividades ka
SET numero = -ka.numero
WHERE ka.numero IS NOT NULL
  AND ka.numero > 0
  AND (ka.origem = 'sirene' OR ka.sirene_chamado_id IS NOT NULL);

-- ─── Renumeração 1..N (created_at, id) ─────────────────────────────────────
-- Fase A: valores negativos temporários (evita violar UNIQUE em sirene_chamados.numero)
WITH ord AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.sirene_chamados
)
UPDATE public.sirene_chamados sc
SET numero = -ord.rn
FROM ord
WHERE sc.id = ord.id;

-- Fase B: numeros finais positivos
WITH ord AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.sirene_chamados
)
UPDATE public.sirene_chamados sc
SET numero = ord.rn
FROM ord
WHERE sc.id = ord.id;

-- Espelhar em kanban_atividades (todas com sirene_chamado_id)
UPDATE public.kanban_atividades ka
SET numero = sc.numero
FROM public.sirene_chamados sc
WHERE ka.sirene_chamado_id = sc.id;

-- Legado: origem sirene sem sirene_chamado_id (órfãos após negativar)
DELETE FROM public.kanban_atividades ka
WHERE ka.origem = 'sirene'
  AND ka.sirene_chamado_id IS NULL
  AND ka.numero < 0;

-- Sincronizar sequência
SELECT setval(
  'public.sirene_numero_seq',
  GREATEST(
    COALESCE((SELECT MAX(numero) FROM public.sirene_chamados), 0),
    COALESCE((SELECT MAX(numero) FROM public.kanban_atividades WHERE numero IS NOT NULL), 0),
    1
  ),
  true
);

-- Pós-execução (ainda na transação)
SELECT 'apos_delete_renumerar' AS etapa,
  COUNT(*) AS total_chamados,
  MIN(numero) AS min_numero,
  MAX(numero) AS max_numero
FROM public.sirene_chamados;

SELECT
  sc.id,
  sc.numero,
  LPAD(sc.numero::text, 4, '0') AS numero_fmt,
  sc.incendio,
  sc.created_at
FROM public.sirene_chamados sc
ORDER BY sc.numero
LIMIT 15;

SELECT last_value AS seq_apos FROM public.sirene_numero_seq;

-- Verificar buracos (deve retornar 0 linhas)
SELECT gs AS numero_faltando
FROM generate_series(
  1,
  (SELECT COALESCE(MAX(numero), 0) FROM public.sirene_chamados)
) gs
WHERE NOT EXISTS (
  SELECT 1 FROM public.sirene_chamados sc WHERE sc.numero = gs
);

ROLLBACK;
-- COMMIT;
