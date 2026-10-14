-- 624: Seção Crédito na lateral do card (terreno, obra e demais alavancagens).
-- Idempotente. Não move cards.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS credito_lateral jsonb;

COMMENT ON COLUMN public.kanban_cards.credito_lateral IS
  'Tranches e valor de alavancagem da seção Crédito. Dívida = valor de origem menos a soma das tranches.';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('624', 'credito_lateral_card')
ON CONFLICT (version) DO NOTHING;
