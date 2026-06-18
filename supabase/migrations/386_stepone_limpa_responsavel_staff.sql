-- 386: Step One — remove responsável da fase gravado como criador staff ou perfil interno.
-- Nota: `valor` legado pode conter nome (texto) em vez de UUID — tratar antes do cast.

-- Remove valores que não são UUID (ex.: nome do franqueado gravado por engano).
DELETE FROM public.kanban_fase_checklist_respostas r
USING public.kanban_cards c,
      public.kanban_fase_checklist_itens i
WHERE r.card_id = c.id
  AND r.item_id = i.id
  AND i.fase_id = c.fase_id
  AND i.campo_slug = 'responsavel_fase'
  AND c.kanban_id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
  AND c.rede_franqueado_id IS NOT NULL
  AND nullif(trim(r.valor), '') IS NOT NULL
  AND trim(r.valor) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

DELETE FROM public.kanban_fase_checklist_respostas r
USING public.kanban_cards c,
      public.kanban_fase_checklist_itens i
WHERE r.card_id = c.id
  AND r.item_id = i.id
  AND i.fase_id = c.fase_id
  AND i.campo_slug = 'responsavel_fase'
  AND c.kanban_id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
  AND c.rede_franqueado_id IS NOT NULL
  AND r.valor = c.franqueado_id::text;

DELETE FROM public.kanban_fase_checklist_respostas r
USING public.kanban_cards c,
      public.kanban_fase_checklist_itens i,
      public.profiles p
WHERE r.card_id = c.id
  AND r.item_id = i.id
  AND i.fase_id = c.fase_id
  AND i.campo_slug = 'responsavel_fase'
  AND c.kanban_id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
  AND c.rede_franqueado_id IS NOT NULL
  AND trim(r.valor) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND p.id = r.valor::uuid
  AND p.role IN ('admin', 'team', 'consultor', 'supervisor');

-- Reaplica backfill com regras da migration 385.
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
    AND c.rede_franqueado_id IS NOT NULL
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
          AND p.role NOT IN ('admin', 'team', 'consultor', 'supervisor')
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
        FROM public.processo_step_one ps
        INNER JOIN public.profiles p ON p.id = ps.user_id
        WHERE ps.id = cs.processo_ref
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
    SELECT cs.card_creator_id::text
    FROM cards_stepone cs
    WHERE cs.card_id = r.card_id
  )
ON CONFLICT (item_id, card_id) DO UPDATE
SET
  valor = EXCLUDED.valor,
  preenchido_em = EXCLUDED.preenchido_em;
