-- 162: Corrige RLS de kanban_cards — adiciona policies de INSERT, UPDATE e DELETE.
-- Diagnóstico: tabela tinha apenas uma policy SELECT (kanban_cards_select_bombeiro_aprov);
-- sem policies de escrita qualquer INSERT retornava "new row violates row-level security policy".
-- Tabela de roles: public.profiles (coluna: role). Valores válidos: 'admin', 'team'.

-- INSERT: admin e team podem criar cards em qualquer kanban
DROP POLICY IF EXISTS "kanban_cards_insert_admin_team" ON public.kanban_cards;
CREATE POLICY "kanban_cards_insert_admin_team"
  ON public.kanban_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team')
    )
  );

-- UPDATE: admin e team podem atualizar qualquer card
DROP POLICY IF EXISTS "kanban_cards_update_admin_team" ON public.kanban_cards;
CREATE POLICY "kanban_cards_update_admin_team"
  ON public.kanban_cards FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team')
    )
  );

-- DELETE: admin e team podem excluir qualquer card
DROP POLICY IF EXISTS "kanban_cards_delete_admin_team" ON public.kanban_cards;
CREATE POLICY "kanban_cards_delete_admin_team"
  ON public.kanban_cards FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team')
    )
  );

-- Garante que authenticated tem os grants necessários
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_cards TO authenticated;
