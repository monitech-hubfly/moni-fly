-- Autor pode excluir apenas o próprio comentário (RLS + grant).

DROP POLICY IF EXISTS "kanban_card_comentarios_delete_autor" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_delete_autor"
  ON public.kanban_card_comentarios
  FOR DELETE
  TO authenticated
  USING (autor_id = auth.uid());

GRANT DELETE ON public.kanban_card_comentarios TO authenticated;
