-- PROD legado: coluna vinculado_a NOT NULL sem preenchimento automático
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kanban_card_vinculos'
      AND column_name = 'vinculado_a'
  ) THEN
    ALTER TABLE public.kanban_card_vinculos ALTER COLUMN vinculado_a DROP NOT NULL;
    UPDATE public.kanban_card_vinculos
    SET vinculado_a = card_destino_id
    WHERE vinculado_a IS NULL AND card_destino_id IS NOT NULL;
  END IF;
END $$;
