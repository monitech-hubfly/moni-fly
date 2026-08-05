-- 502: Funil Jurídico — responsável padrão Isabela Correa + exclusão de todos os cards.
-- Funil permanece desativado (501). Cascata DB remove comentários, checklists, atividades, tags, vínculos.

-- ─── Backfill: Funil Jurídico — todas as fases → Isabela Correa ───
WITH alvos_juridico AS (
  SELECT
    c.id AS card_id,
    i.id AS item_id,
    p.id::text AS user_id
  FROM public.kanban_cards c
  INNER JOIN public.kanban_fases f ON f.id = c.fase_id
  INNER JOIN public.kanbans k ON k.id = c.kanban_id
  INNER JOIN public.profiles p
    ON lower(trim(p.email)) = lower('isabela.correa@moni.casa')
  INNER JOIN public.kanban_fase_checklist_itens i
    ON i.fase_id = c.fase_id
   AND i.campo_slug = 'responsavel_fase'
  WHERE (k.id = '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid OR k.nome = 'Funil Jurídico')
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
FROM alvos_juridico a
ON CONFLICT (item_id, card_id) DO UPDATE
SET
  valor = EXCLUDED.valor,
  preenchido_em = EXCLUDED.preenchido_em;

-- ─── Zerar flag juridico_ok nos cards pai (Portfólio / esteira) ───
UPDATE public.kanban_cards pai
SET juridico_ok = false
WHERE COALESCE(pai.juridico_ok, false) = true
  AND pai.id IN (
    SELECT DISTINCT c.origem_card_id
    FROM public.kanban_cards c
    INNER JOIN public.kanbans k ON k.id = c.kanban_id
    WHERE (k.id = '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid OR k.nome = 'Funil Jurídico')
      AND c.origem_card_id IS NOT NULL
  );

-- ─── Hard delete: todos os cards do Funil Jurídico ───
DELETE FROM public.kanban_cards c
USING public.kanbans k
WHERE c.kanban_id = k.id
  AND (k.id = '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid OR k.nome = 'Funil Jurídico');

-- ─── Verificação ───
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*)::int INTO v_count
  FROM public.kanban_cards c
  INNER JOIN public.kanbans k ON k.id = c.kanban_id
  WHERE k.id = '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid
     OR k.nome = 'Funil Jurídico';

  IF v_count > 0 THEN
    RAISE EXCEPTION '502: ainda restam % card(s) no Funil Jurídico', v_count;
  END IF;

  RAISE NOTICE '502: Funil Jurídico — 0 cards restantes; responsável padrão isabela.correa@moni.casa';
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('502', 'funil_juridico_isabela_excluir_cards')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
