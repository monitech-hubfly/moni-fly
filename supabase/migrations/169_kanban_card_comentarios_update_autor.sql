-- Autor pode editar apenas o próprio comentário (RLS + grant).

DROP POLICY IF EXISTS "kanban_card_comentarios_update_autor" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_update_autor"
  ON public.kanban_card_comentarios
  FOR UPDATE
  TO authenticated
  USING (autor_id = auth.uid())
  WITH CHECK (autor_id = auth.uid());

GRANT UPDATE ON public.kanban_card_comentarios TO authenticated;
