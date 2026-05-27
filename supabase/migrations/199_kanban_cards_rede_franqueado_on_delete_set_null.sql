-- Ao excluir rede_franqueados, desvincular kanban_cards (ON DELETE SET NULL).
-- Em alguns ambientes a FK foi criada sem essa ação e o Table Editor bloqueia o DELETE.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'kanban_cards'
      AND constraint_name = 'kanban_cards_rede_franqueado_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.kanban_cards DROP CONSTRAINT kanban_cards_rede_franqueado_id_fkey';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kanban_cards'
      AND column_name = 'rede_franqueado_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.kanban_cards
      ADD CONSTRAINT kanban_cards_rede_franqueado_id_fkey
      FOREIGN KEY (rede_franqueado_id) REFERENCES public.rede_franqueados(id) ON DELETE SET NULL';
  END IF;
END $$;
