-- 366: kanban_cards — GRANT service_role + escrita para consultor/supervisor (alinhado ao SELECT da 163).
-- Corrige "permission denied for table kanban_cards" no create via service role e no Funil Step One.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_cards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processo_step_one TO service_role;

DROP POLICY IF EXISTS "kanban_cards_insert_admin_team" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_insert_staff" ON public.kanban_cards;
CREATE POLICY "kanban_cards_insert_staff"
  ON public.kanban_cards FOR INSERT
  TO authenticated
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
  ON public.kanban_cards FOR UPDATE
  TO authenticated
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
  ON public.kanban_cards FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

NOTIFY pgrst, 'reload schema';
