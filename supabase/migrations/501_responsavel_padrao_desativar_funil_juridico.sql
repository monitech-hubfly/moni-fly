-- 501: Defaults de responsável do card (Acoplamento + Homologações) e desativação do Funil Jurídico.

-- ─── Backfill: Acoplamento — fases novo_acoplamento + alteracoes_acoplamento → Elisabete Nucci ───
WITH alvos_acoplamento AS (
  SELECT
    c.id AS card_id,
    i.id AS item_id,
    p.id::text AS user_id
  FROM public.kanban_cards c
  INNER JOIN public.kanban_fases f ON f.id = c.fase_id
  INNER JOIN public.kanbans k ON k.id = c.kanban_id
  INNER JOIN public.profiles p
    ON lower(trim(p.email)) = lower('elisabete.nucci@moni.casa')
  INNER JOIN public.kanban_fase_checklist_itens i
    ON i.fase_id = c.fase_id
   AND i.campo_slug = 'responsavel_fase'
  WHERE (k.id = '15847602-231d-4937-a06f-82027eb87ef3'::uuid OR k.nome = 'Funil Acoplamento')
    AND f.slug IN ('novo_acoplamento', 'alteracoes_acoplamento')
    AND COALESCE(f.ativo, true) = true
    AND COALESCE(c.arquivado, false) = false
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
FROM alvos_acoplamento a
ON CONFLICT (item_id, card_id) DO UPDATE
SET
  valor = EXCLUDED.valor,
  preenchido_em = EXCLUDED.preenchido_em;

-- ─── Backfill: Homologações — todos os cards → Karoline Galdino ───
WITH alvos_homologacoes AS (
  SELECT
    c.id AS card_id,
    i.id AS item_id,
    p.id::text AS user_id
  FROM public.kanban_cards c
  INNER JOIN public.kanbans k ON k.id = c.kanban_id
  INNER JOIN public.profiles p
    ON lower(trim(p.email)) = lower('karoline.galdino@moni.casa')
  INNER JOIN public.kanban_fase_checklist_itens i
    ON i.fase_id = c.fase_id
   AND i.campo_slug = 'responsavel_fase'
  WHERE (k.id = '69bf5668-7749-476a-a834-962a0bb0eef7'::uuid OR k.nome = 'Funil Homologações')
    AND COALESCE(c.arquivado, false) = false
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
FROM alvos_homologacoes a
ON CONFLICT (item_id, card_id) DO UPDATE
SET
  valor = EXCLUDED.valor,
  preenchido_em = EXCLUDED.preenchido_em;

-- ─── Desativar Funil Jurídico (kanban + fases) — cards preservados ───
UPDATE public.kanbans
SET ativo = false
WHERE id = '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid
   OR nome = 'Funil Jurídico';

UPDATE public.kanban_fases
SET ativo = false
WHERE kanban_id = '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid
   OR kanban_id IN (
     SELECT id FROM public.kanbans WHERE nome = 'Funil Jurídico'
   );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('501', 'responsavel_padrao_desativar_funil_juridico')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
