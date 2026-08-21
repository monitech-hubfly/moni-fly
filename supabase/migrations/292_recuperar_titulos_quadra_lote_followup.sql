-- 292: Recupera quadra/lote/condomínio nos títulos e reforça data_followup.
-- Corrige efeitos colaterais da migration 289 (passo 2 podia reduzir título só ao FK).

-- ── Campos do processo → kanban_cards ───────────────────────────────────────
UPDATE public.kanban_cards k
SET
  nome_condominio = COALESCE(NULLIF(trim(k.nome_condominio), ''), NULLIF(trim(p.nome_condominio), '')),
  quadra = COALESCE(NULLIF(trim(k.quadra), ''), NULLIF(trim(p.quadra), '')),
  lote = COALESCE(NULLIF(trim(k.lote), ''), NULLIF(trim(p.lote), '')),
  updated_at = now()
FROM public.processo_step_one p
WHERE (
    k.id = p.id
    OR (k.projeto_id IS NOT NULL AND k.projeto_id = p.id)
  )
  AND (
    (NULLIF(trim(k.nome_condominio), '') IS NULL AND NULLIF(trim(p.nome_condominio), '') IS NOT NULL)
    OR (NULLIF(trim(k.quadra), '') IS NULL AND NULLIF(trim(p.quadra), '') IS NOT NULL)
    OR (NULLIF(trim(k.lote), '') IS NULL AND NULLIF(trim(p.lote), '') IS NOT NULL)
  );

-- quadra_lote legado "Q/L" no processo
UPDATE public.kanban_cards k
SET
  quadra = COALESCE(
    NULLIF(trim(k.quadra), ''),
    NULLIF(trim(split_part(coalesce(p.quadra_lote, ''), '/', 1)), '')
  ),
  lote = COALESCE(
    NULLIF(trim(k.lote), ''),
    NULLIF(trim(split_part(coalesce(p.quadra_lote, ''), '/', 2)), '')
  ),
  updated_at = now()
FROM public.processo_step_one p
WHERE (k.id = p.id OR (k.projeto_id IS NOT NULL AND k.projeto_id = p.id))
  AND NULLIF(trim(p.quadra_lote), '') IS NOT NULL
  AND (
    NULLIF(trim(k.quadra), '') IS NULL
    OR NULLIF(trim(k.lote), '') IS NULL
  );

-- condominio_id → nome_condominio
UPDATE public.kanban_cards k
SET
  nome_condominio = COALESCE(NULLIF(trim(k.nome_condominio), ''), NULLIF(trim(c.nome), '')),
  updated_at = now()
FROM public.condominios c
WHERE k.condominio_id = c.id
  AND NULLIF(trim(k.nome_condominio), '') IS NULL
  AND NULLIF(trim(c.nome), '') IS NOT NULL;

-- Extrair condomínio/quadra/lote do título ainda completo (FK - … - … - …)
WITH parsed AS (
  SELECT
    k.id,
    NULLIF(trim(parts[2]), '') AS nome_condominio,
    CASE WHEN array_length(parts, 1) >= 4 THEN NULLIF(trim(parts[3]), '') END AS quadra,
    CASE WHEN array_length(parts, 1) >= 4 THEN NULLIF(trim(parts[4]), '') END AS lote
  FROM public.kanban_cards k
  CROSS JOIN LATERAL (
    SELECT string_to_array(k.titulo, ' - ') AS parts
  ) s
  WHERE k.titulo ~* '^FK[0-9]+'
    AND array_length(s.parts, 1) >= 3
)
UPDATE public.kanban_cards k
SET
  nome_condominio = COALESCE(NULLIF(trim(k.nome_condominio), ''), p.nome_condominio),
  quadra = COALESCE(NULLIF(trim(k.quadra), ''), p.quadra),
  lote = COALESCE(NULLIF(trim(k.lote), ''), p.lote),
  updated_at = now()
FROM parsed p
WHERE k.id = p.id
  AND (
    (NULLIF(trim(k.nome_condominio), '') IS NULL AND p.nome_condominio IS NOT NULL)
    OR (NULLIF(trim(k.quadra), '') IS NULL AND p.quadra IS NOT NULL)
    OR (NULLIF(trim(k.lote), '') IS NULL AND p.lote IS NOT NULL)
  );

-- Reconstruir título canônico (FK + condomínio + quadra + lote)
UPDATE public.kanban_cards kc
SET
  titulo = sub.novo_titulo,
  updated_at = now()
FROM (
  SELECT
    kc2.id,
    NULLIF(
      TRIM(
        CONCAT_WS(
          ' - ',
          NULLIF(TRIM(rf.n_franquia), ''),
          NULLIF(TRIM(kc2.nome_condominio), ''),
          NULLIF(TRIM(kc2.quadra), ''),
          NULLIF(TRIM(kc2.lote), '')
        )
      ),
      ''
    ) AS novo_titulo
  FROM public.kanban_cards kc2
  LEFT JOIN public.rede_franqueados rf ON rf.id = kc2.rede_franqueado_id
  WHERE NULLIF(TRIM(COALESCE(rf.n_franquia, split_part(kc2.titulo, ' - ', 1))), '') IS NOT NULL
) sub
WHERE kc.id = sub.id
  AND sub.novo_titulo IS NOT NULL
  AND COALESCE(TRIM(kc.titulo), '') IS DISTINCT FROM sub.novo_titulo;

-- Cards filhos (Funil Acoplamento / bastões): herdam campos do card pai (origem_card_id)
DO $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..32 LOOP
    UPDATE public.kanban_cards filho
    SET
      titulo = CASE
        WHEN length(trim(coalesce(pai.titulo, ''))) > length(trim(coalesce(filho.titulo, '')))
          THEN pai.titulo
        ELSE filho.titulo
      END,
      nome_condominio = coalesce(NULLIF(trim(filho.nome_condominio), ''), NULLIF(trim(pai.nome_condominio), '')),
      quadra = coalesce(NULLIF(trim(filho.quadra), ''), NULLIF(trim(pai.quadra), '')),
      lote = coalesce(NULLIF(trim(filho.lote), ''), NULLIF(trim(pai.lote), '')),
      rede_franqueado_id = coalesce(filho.rede_franqueado_id, pai.rede_franqueado_id),
      condominio_id = coalesce(filho.condominio_id, pai.condominio_id),
      data_followup = coalesce(filho.data_followup, pai.data_followup),
      updated_at = now()
    FROM public.kanban_cards pai
    WHERE filho.origem_card_id = pai.id
      AND (
        length(trim(coalesce(pai.titulo, ''))) > length(trim(coalesce(filho.titulo, '')))
        OR (NULLIF(trim(filho.nome_condominio), '') IS NULL AND NULLIF(trim(pai.nome_condominio), '') IS NOT NULL)
        OR (NULLIF(trim(filho.quadra), '') IS NULL AND NULLIF(trim(pai.quadra), '') IS NOT NULL)
        OR (NULLIF(trim(filho.lote), '') IS NULL AND NULLIF(trim(pai.lote), '') IS NOT NULL)
        OR (filho.data_followup IS NULL AND pai.data_followup IS NOT NULL)
      );
  END LOOP;
END $$;

-- Mesmo projeto_id: propaga título/campos mais completos entre cards paralelos
DO $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    UPDATE public.kanban_cards alvo
    SET
      titulo = CASE
        WHEN length(trim(coalesce(fonte.titulo, ''))) > length(trim(coalesce(alvo.titulo, '')))
          THEN fonte.titulo
        ELSE alvo.titulo
      END,
      nome_condominio = coalesce(NULLIF(trim(alvo.nome_condominio), ''), NULLIF(trim(fonte.nome_condominio), '')),
      quadra = coalesce(NULLIF(trim(alvo.quadra), ''), NULLIF(trim(fonte.quadra), '')),
      lote = coalesce(NULLIF(trim(alvo.lote), ''), NULLIF(trim(fonte.lote), '')),
      data_followup = coalesce(alvo.data_followup, fonte.data_followup),
      updated_at = now()
    FROM public.kanban_cards fonte
    WHERE alvo.projeto_id IS NOT NULL
      AND alvo.projeto_id = fonte.projeto_id
      AND alvo.id <> fonte.id
      AND (
        length(trim(coalesce(fonte.titulo, ''))) > length(trim(coalesce(alvo.titulo, '')))
        OR (NULLIF(trim(alvo.nome_condominio), '') IS NULL AND NULLIF(trim(fonte.nome_condominio), '') IS NOT NULL)
        OR (NULLIF(trim(alvo.quadra), '') IS NULL AND NULLIF(trim(fonte.quadra), '') IS NOT NULL)
        OR (NULLIF(trim(alvo.lote), '') IS NULL AND NULLIF(trim(fonte.lote), '') IS NOT NULL)
        OR (alvo.data_followup IS NULL AND fonte.data_followup IS NOT NULL)
      );
  END LOOP;
END $$;

-- Reconstruir título após herança pai/projeto
UPDATE public.kanban_cards kc
SET titulo = sub.novo_titulo, updated_at = now()
FROM (
  SELECT
    kc2.id,
    NULLIF(
      TRIM(
        CONCAT_WS(
          ' - ',
          NULLIF(TRIM(COALESCE(rf.n_franquia, split_part(kc2.titulo, ' - ', 1))), ''),
          NULLIF(TRIM(kc2.nome_condominio), ''),
          NULLIF(TRIM(kc2.quadra), ''),
          NULLIF(TRIM(kc2.lote), '')
        )
      ),
      ''
    ) AS novo_titulo
  FROM public.kanban_cards kc2
  LEFT JOIN public.rede_franqueados rf ON rf.id = kc2.rede_franqueado_id
) sub
WHERE kc.id = sub.id
  AND sub.novo_titulo IS NOT NULL
  AND length(trim(sub.novo_titulo)) > length(trim(coalesce(kc.titulo, '')));

-- Follow-up: atividades pendentes com data_vencimento
WITH vencimentos AS (
  SELECT
    a.card_id,
    max(a.data_vencimento) AS data_followup
  FROM public.kanban_atividades a
  WHERE a.data_vencimento IS NOT NULL
    AND coalesce(a.status, '') NOT IN ('concluida', 'cancelada')
  GROUP BY a.card_id
)
UPDATE public.kanban_cards c
SET
  data_followup = v.data_followup,
  updated_at = now()
FROM vencimentos v
WHERE c.id = v.card_id
  AND c.data_followup IS NULL
  AND c.arquivado = false
  AND c.concluido = false;

-- Follow-up: cards do mesmo sync group (mesmo projeto_id)
UPDATE public.kanban_cards dest
SET
  data_followup = src.data_followup,
  updated_at = now()
FROM (
  SELECT
    projeto_id,
    max(data_followup) AS data_followup
  FROM public.kanban_cards
  WHERE data_followup IS NOT NULL
    AND projeto_id IS NOT NULL
  GROUP BY projeto_id
) src
WHERE dest.data_followup IS NULL
  AND dest.arquivado = false
  AND dest.concluido = false
  AND dest.projeto_id IS NOT NULL
  AND dest.projeto_id = src.projeto_id;

-- Espelhar follow-up kanban → processo (reforço)
UPDATE public.processo_step_one p
SET
  data_followup = k.data_followup,
  updated_at = now()
FROM public.kanban_cards k
WHERE p.data_followup IS NULL
  AND k.data_followup IS NOT NULL
  AND (
    p.id = k.id
    OR (k.projeto_id IS NOT NULL AND p.id = k.projeto_id)
  );
