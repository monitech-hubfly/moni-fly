-- 384: Corrige responsável da fase — owners por funil + franqueado da rede no Step One.
-- Substitui valores gravados erroneamente com o criador do card (franqueado_id).

-- Funis com owner fixo do time (sem Step One).
WITH mapa_funil_responsavel AS (
  SELECT *
  FROM (
    VALUES
      ('c57120a0-991c-422b-8def-4d16a9411d45'::uuid, 'renata.silva@moni.casa'),
      ('15847602-231d-4937-a06f-82027eb87ef3'::uuid, 'elisabete.nucci@moni.casa'),
      ('39de341d-aebf-481c-9118-ce6fc6574187'::uuid, 'elisabete.nucci@moni.casa'),
      ('c2ab09bd-4bd6-491e-8734-281d7678a6ad'::uuid, 'larissa.lima@moni.casa'),
      ('724aef36-37de-4454-bf6f-ec481693aeeb'::uuid, 'kim@moni.casa'),
      ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, 'kim@moni.casa')
  ) AS t(kanban_id, email_responsavel)
),
alvos_funil AS (
  SELECT
    c.id AS card_id,
    i.id AS item_id,
    p.id::text AS user_id
  FROM mapa_funil_responsavel m
  INNER JOIN public.profiles p
    ON lower(trim(p.email)) = lower(trim(m.email_responsavel))
  INNER JOIN public.kanban_cards c
    ON c.kanban_id = m.kanban_id
  INNER JOIN public.kanban_fase_checklist_itens i
    ON i.fase_id = c.fase_id
   AND i.campo_slug = 'responsavel_fase'
)
INSERT INTO public.kanban_fase_checklist_respostas (
  item_id,
  card_id,
  valor,
  preenchido_em
)
SELECT
  a.item_id,
  a.card_id,
  a.user_id,
  NOW()
FROM alvos_funil a
ON CONFLICT (item_id, card_id) DO UPDATE
SET
  valor = EXCLUDED.valor,
  preenchido_em = EXCLUDED.preenchido_em;

-- Funil Step One — franqueado via rede / processo (não o criador do card).
WITH cards_stepone AS (
  SELECT
    c.id AS card_id,
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
        LIMIT 1
      ),
      (
        SELECT ps.user_id::text
        FROM public.rede_franqueados rf
        INNER JOIN public.processo_step_one ps ON ps.id = rf.processo_id
        WHERE rf.id = cs.rede_franqueado_id
        LIMIT 1
      ),
      (
        SELECT ps.user_id::text
        FROM public.processo_step_one ps
        WHERE ps.id = cs.processo_ref
        LIMIT 1
      ),
      (
        SELECT p2.id::text
        FROM public.processo_step_one ps2
        INNER JOIN public.profiles p2
          ON p2.rede_franqueado_id = ps2.origem_rede_franqueados_id
        WHERE ps2.id = cs.processo_ref
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
ON CONFLICT (item_id, card_id) DO UPDATE
SET
  valor = EXCLUDED.valor,
  preenchido_em = EXCLUDED.preenchido_em;
