-- 268: Repara rede_franqueado_id perdido a partir de processo_step_one e prefixo FK no título.
-- Complementa 262/266 (origem/vínculos) quando o grupo inteiro perdeu o vínculo.
-- SQL Editor: re-execute cada bloco até a verificação retornar 0.

-- ══════════════════════════════════════════════════════════════════════════════
-- 268a — processo_step_one.origem_rede_franqueados_id → kanban_cards
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.kanban_cards k
SET rede_franqueado_id = batch.origem_rede_franqueados_id
FROM (
  SELECT k2.id, ps.origem_rede_franqueados_id
  FROM public.kanban_cards k2
  JOIN public.processo_step_one ps ON (
    ps.id = k2.id
    OR ps.id = k2.projeto_id
    OR k2.projeto_id = ps.id
  )
  WHERE k2.rede_franqueado_id IS NULL
    AND ps.origem_rede_franqueados_id IS NOT NULL
  LIMIT 100
) batch
WHERE k.id = batch.id;

SELECT count(*) AS pendentes_processo_origem
FROM public.kanban_cards k2
JOIN public.processo_step_one ps ON (
  ps.id = k2.id OR ps.id = k2.projeto_id OR k2.projeto_id = ps.id
)
WHERE k2.rede_franqueado_id IS NULL
  AND ps.origem_rede_franqueados_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- 268b — processo_step_one.numero_franquia → rede_franqueados
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.kanban_cards k
SET rede_franqueado_id = batch.rede_id
FROM (
  SELECT k2.id, rf.id AS rede_id
  FROM public.kanban_cards k2
  JOIN public.processo_step_one ps ON (
    ps.id = k2.id
    OR ps.id = k2.projeto_id
    OR k2.projeto_id = ps.id
  )
  JOIN public.rede_franqueados rf ON rf.n_franquia = ps.numero_franquia
  WHERE k2.rede_franqueado_id IS NULL
    AND ps.numero_franquia IS NOT NULL
    AND ps.numero_franquia <> 'FK0000'
  LIMIT 100
) batch
WHERE k.id = batch.id;

SELECT count(*) AS pendentes_processo_numero
FROM public.kanban_cards k2
JOIN public.processo_step_one ps ON (
  ps.id = k2.id OR ps.id = k2.projeto_id OR k2.projeto_id = ps.id
)
JOIN public.rede_franqueados rf ON rf.n_franquia = ps.numero_franquia
WHERE k2.rede_franqueado_id IS NULL
  AND ps.numero_franquia IS NOT NULL
  AND ps.numero_franquia <> 'FK0000';

-- ══════════════════════════════════════════════════════════════════════════════
-- 268c — prefixo FK no título → rede_franqueados.n_franquia
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.kanban_cards k
SET rede_franqueado_id = rf.id
FROM public.rede_franqueados rf
WHERE k.rede_franqueado_id IS NULL
  AND k.titulo LIKE 'FK%'
  AND rf.n_franquia = split_part(k.titulo, ' - ', 1)
  AND rf.n_franquia <> 'FK0000'
  AND k.id IN (
    SELECT k2.id
    FROM public.kanban_cards k2
    JOIN public.rede_franqueados rf2 ON rf2.n_franquia = split_part(k2.titulo, ' - ', 1)
    WHERE k2.rede_franqueado_id IS NULL
      AND k2.titulo LIKE 'FK%'
      AND rf2.n_franquia <> 'FK0000'
    LIMIT 100
  );

SELECT count(*) AS pendentes_titulo_fk
FROM public.kanban_cards k2
JOIN public.rede_franqueados rf ON rf.n_franquia = split_part(k2.titulo, ' - ', 1)
WHERE k2.rede_franqueado_id IS NULL
  AND k2.titulo LIKE 'FK%'
  AND rf.n_franquia <> 'FK0000';

-- ══════════════════════════════════════════════════════════════════════════════
-- 268d — nome_condominio do card = processo com origem_rede preenchida
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.kanban_cards k
SET rede_franqueado_id = batch.rede_id
FROM (
  SELECT DISTINCT ON (k2.id) k2.id, ps.origem_rede_franqueados_id AS rede_id
  FROM public.kanban_cards k2
  JOIN public.processo_step_one ps
    ON lower(trim(ps.nome_condominio)) = lower(trim(k2.nome_condominio))
  WHERE k2.rede_franqueado_id IS NULL
    AND k2.nome_condominio IS NOT NULL
    AND trim(k2.nome_condominio) <> ''
    AND ps.origem_rede_franqueados_id IS NOT NULL
  ORDER BY k2.id, ps.updated_at DESC NULLS LAST
  LIMIT 100
) batch
WHERE k.id = batch.id;

SELECT count(*) AS pendentes_nome_condominio
FROM public.kanban_cards k2
JOIN public.processo_step_one ps
  ON lower(trim(ps.nome_condominio)) = lower(trim(k2.nome_condominio))
WHERE k2.rede_franqueado_id IS NULL
  AND k2.nome_condominio IS NOT NULL
  AND trim(k2.nome_condominio) <> ''
  AND ps.origem_rede_franqueados_id IS NOT NULL;
