-- 642: FKs do cadastro de empreendimentos para o card e o condomínio.
-- O embed do PostgREST precisa do nome da constraint, porque kanban_cards
-- também aponta de volta para imob_empreendimentos.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'imob_empreendimentos_card_id_fkey'
  ) THEN
    ALTER TABLE public.imob_empreendimentos
      ADD CONSTRAINT imob_empreendimentos_card_id_fkey
      FOREIGN KEY (card_id) REFERENCES public.kanban_cards(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'imob_empreendimentos_condominio_id_fkey'
  ) THEN
    ALTER TABLE public.imob_empreendimentos
      ADD CONSTRAINT imob_empreendimentos_condominio_id_fkey
      FOREIGN KEY (condominio_id) REFERENCES public.condominios(id) ON DELETE SET NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('642', 'imob_empreendimentos_fks_card_condominio')
ON CONFLICT (version) DO NOTHING;
