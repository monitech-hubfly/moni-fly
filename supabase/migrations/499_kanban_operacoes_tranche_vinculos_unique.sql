-- 499: UNIQUE (operacoes_card_id, tranche_index) — exigido pelo upsert da 2ª–6ª tranche.
-- A tabela foi criada em 221/262 sem UNIQUE; a 230 usa IF NOT EXISTS e não adicionou a constraint.

ALTER TABLE public.kanban_operacoes_tranche_vinculos
  DROP CONSTRAINT IF EXISTS kanban_operacoes_tranche_vinculos_operacoes_card_id_fkey;

ALTER TABLE public.kanban_operacoes_tranche_vinculos
  ADD CONSTRAINT kanban_operacoes_tranche_vinculos_operacoes_card_id_fkey
  FOREIGN KEY (operacoes_card_id) REFERENCES public.kanban_cards (id) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_kanban_operacoes_tranche_vinculos_card;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_operacoes_tranche_vinculos_card
  ON public.kanban_operacoes_tranche_vinculos (operacoes_card_id, tranche_index);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('499', 'kanban_operacoes_tranche_vinculos_unique')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
