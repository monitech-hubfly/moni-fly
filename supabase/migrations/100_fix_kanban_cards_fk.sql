-- Fix: Adicionar foreign key constraint que está faltando
-- e corrigir o relacionamento entre kanban_cards e profiles

-- Remove constraint antiga se existir (com nome diferente)
DO $$
BEGIN
  -- Remove qualquer constraint de FK existente para franqueado_id
  ALTER TABLE public.kanban_cards 
  DROP CONSTRAINT IF EXISTS kanban_cards_franqueado_id_fkey;
  
  ALTER TABLE public.kanban_cards 
  DROP CONSTRAINT IF EXISTS fk_kanban_cards_franqueado;
EXCEPTION
  WHEN undefined_object THEN
    NULL; -- Ignora se não existir
END $$;

-- Adiciona a foreign key corretamente
ALTER TABLE public.kanban_cards
ADD CONSTRAINT kanban_cards_franqueado_id_fkey
FOREIGN KEY (franqueado_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Cria índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_kanban_cards_franqueado_id 
ON public.kanban_cards(franqueado_id);

-- Verifica se a constraint foi criada
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'kanban_cards'
  AND kcu.column_name = 'franqueado_id';
