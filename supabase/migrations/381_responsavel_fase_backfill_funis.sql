-- 381: Backfill «Responsável da fase» (fase atual) por funil — owners padrão do time.
-- Requer migration 380 (campo responsavel_fase nas fases).
-- Idempotente: sobrescreve valor existente no item da fase atual de cada card.

WITH mapa_funil_responsavel AS (
  SELECT *
  FROM (
    VALUES
      -- Renata Silva — Time Portfólio
      ('4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid, 'renata.silva@moni.casa'),
      ('c57120a0-991c-422b-8def-4d16a9411d45'::uuid, 'renata.silva@moni.casa'),
      -- Elisabete Nucci — Acoplamento / Projeto Legal
      ('15847602-231d-4937-a06f-82027eb87ef3'::uuid, 'elisabete.nucci@moni.casa'),
      ('39de341d-aebf-481c-9118-ce6fc6574187'::uuid, 'elisabete.nucci@moni.casa'),
      -- Larissa Lima — Projetos Locais
      ('c2ab09bd-4bd6-491e-8734-281d7678a6ad'::uuid, 'larissa.lima@moni.casa'),
      -- Thais Kim — Moní Capital / Crédito Obra
      ('724aef36-37de-4454-bf6f-ec481693aeeb'::uuid, 'kim@moni.casa'),
      ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, 'kim@moni.casa')
  ) AS t(kanban_id, email_responsavel)
),
alvos AS (
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
FROM alvos a
ON CONFLICT (item_id, card_id) DO UPDATE
SET
  valor = EXCLUDED.valor,
  preenchido_em = EXCLUDED.preenchido_em;
