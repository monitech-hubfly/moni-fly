-- Fix DEV: permissões kanban_cards + coluna processo_step_one_id + SELECT staff
-- Idempotente — pode rodar mais de uma vez.
-- Cole no Supabase SQL Editor (projeto DEV) e execute.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_cards TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processo_step_one TO authenticated, service_role;

-- SELECT: staff vê todos; franqueado vê os próprios (migration 163)
DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;
CREATE POLICY "kanban_cards_select"
  ON public.kanban_cards FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
    OR franqueado_id = auth.uid()
  );

DROP POLICY IF EXISTS "kanban_cards_insert_admin_team" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_insert_staff" ON public.kanban_cards;
CREATE POLICY "kanban_cards_insert_staff"
  ON public.kanban_cards FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "kanban_cards_update_admin_team" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_update_staff" ON public.kanban_cards;
CREATE POLICY "kanban_cards_update_staff"
  ON public.kanban_cards FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "kanban_cards_delete_admin_team" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_delete_staff" ON public.kanban_cards;
CREATE POLICY "kanban_cards_delete_staff"
  ON public.kanban_cards FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

-- Coluna processo_step_one_id
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS processo_step_one_id UUID
  REFERENCES public.processo_step_one(id) ON DELETE SET NULL;

-- Coluna hora_reuniao (migration 344 — board quebrava SELECT sem ela)
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS hora_reuniao TEXT;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_processo_step_one_id
  ON public.kanban_cards (processo_step_one_id)
  WHERE processo_step_one_id IS NOT NULL;

-- Cards novos sem default explícito: normalizar NULL → false (board filtra concluido/arquivado)
UPDATE public.kanban_cards SET concluido = false WHERE concluido IS NULL;
UPDATE public.kanban_cards SET arquivado = false WHERE arquivado IS NULL;

NOTIFY pgrst, 'reload schema';
