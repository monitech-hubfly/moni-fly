-- 385: Funil Step One — responsável da fase = franqueado da rede (não criador staff do card).

WITH cards_stepone AS (
  SELECT
    c.id AS card_id,
    c.franqueado_id AS card_creator_id,
    i.id AS item_id,
    c.rede_franqueado_id,
    COALESCE(c.processo_step_one_id, c.id) AS processo_ref
  FROM public.kanban_cards c
  INNER JOIN public.kanban_fase_checklist_itens i
    ON i.fase_id = c.fase_id
   AND i.campo_slug = 'responsavel_fase'
  WHERE c.kanban_id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
),
resolved_stepone AS (
  SELECT
    cs.card_id,
    cs.item_id,
    COALESCE(
      (
        SELECT p.id::text
        FROM public.profiles p
        WHERE p.rede_franqueado_id = cs.rede_franqueado_id
          AND p.role IN ('frank', 'franqueado')
        LIMIT 1
      ),
      (
        SELECT p.id::text
        FROM public.rede_franqueados rf
        INNER JOIN public.profiles p
          ON lower(trim(p.email)) = lower(trim(rf.email_frank))
        WHERE rf.id = cs.rede_franqueado_id
          AND nullif(trim(rf.email_frank), '') IS NOT NULL
        LIMIT 1
      ),
      (
        SELECT p.id::text
        FROM public.rede_franqueados rf
        INNER JOIN public.profiles p
          ON lower(trim(p.full_name)) = lower(trim(rf.nome_completo))
        WHERE rf.id = cs.rede_franqueado_id
          AND nullif(trim(rf.nome_completo), '') IS NOT NULL
          AND p.role IN ('frank', 'franqueado')
        LIMIT 1
      ),
      (
        SELECT p.id::text
        FROM public.rede_franqueados rf
        INNER JOIN public.processo_step_one ps ON ps.id = rf.processo_id
        INNER JOIN public.profiles p ON p.id = ps.user_id
        WHERE rf.id = cs.rede_franqueado_id
          AND p.role IN ('frank', 'franqueado')
        LIMIT 1
      ),
      (
        SELECT p.id::text
        FROM public.processo_step_one ps
        INNER JOIN public.profiles p ON p.id = ps.user_id
        WHERE ps.id = cs.processo_ref
          AND p.role IN ('frank', 'franqueado')
        LIMIT 1
      ),
      (
        SELECT p.id::text
        FROM public.processo_step_one ps
        INNER JOIN public.profiles p ON p.id = ps.user_id
        WHERE ps.id = cs.processo_ref
          AND ps.origem_rede_franqueados_id IS NOT NULL
          AND p.rede_franqueado_id = ps.origem_rede_franqueados_id
          AND p.role IN ('frank', 'franqueado')
        LIMIT 1
      )
    ) AS user_id
  FROM cards_stepone cs
)
INSERT INTO public.kanban_fase_checklist_respostas (
  item_id,
  card_id,
  valor,
  preenchido_em
)
SELECT
  r.item_id,
  r.card_id,
  r.user_id,
  NOW()
FROM resolved_stepone r
WHERE r.user_id IS NOT NULL
  AND r.user_id IS DISTINCT FROM (
    SELECT cs.card_creator_id::text FROM cards_stepone cs WHERE cs.card_id = r.card_id
  )
ON CONFLICT (item_id, card_id) DO UPDATE
SET
  valor = EXCLUDED.valor,
  preenchido_em = EXCLUDED.preenchido_em;
