-- Fix RLS policies para kanban_cards
-- Garantir que admins possam ver todos os cards

-- Desabilita RLS temporariamente para debug
-- ALTER TABLE public.kanban_cards DISABLE ROW LEVEL SECURITY;

-- Ou mantém RLS mas corrige as policies

-- Remove policies antigas
DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_insert" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_update" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_delete" ON public.kanban_cards;

-- Policy de SELECT: admin vê tudo, franqueado vê só os seus
CREATE POLICY "kanban_cards_select"
ON public.kanban_cards
FOR SELECT
USING (
  -- Admin ou consultor vê tudo
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  -- Franqueado vê apenas os próprios cards
  franqueado_id = auth.uid()
);

-- Policy de INSERT: qualquer usuário autenticado pode criar
CREATE POLICY "kanban_cards_insert"
ON public.kanban_cards
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Admin/consultor pode criar para qualquer um
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR
    -- Franqueado só pode criar cards para si mesmo
    franqueado_id = auth.uid()
  )
);

-- Policy de UPDATE: mesmo critério do SELECT
CREATE POLICY "kanban_cards_update"
ON public.kanban_cards
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  franqueado_id = auth.uid()
);

-- Policy de DELETE: mesmo critério
CREATE POLICY "kanban_cards_delete"
ON public.kanban_cards
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  franqueado_id = auth.uid()
);

-- Verificar as policies criadas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'kanban_cards';
