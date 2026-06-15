-- 368: kanban_cards SELECT staff + normalizar concluido/arquivado NULL (cards invisíveis no board).

GRANT SELECT ON public.kanban_cards TO authenticated;

DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;
CREATE POLICY "kanban_cards_select"
  ON public.kanban_cards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
    OR franqueado_id = auth.uid()
  );

UPDATE public.kanban_cards SET concluido = false WHERE concluido IS NULL;
UPDATE public.kanban_cards SET arquivado = false WHERE arquivado IS NULL;

ALTER TABLE public.kanban_cards
  ALTER COLUMN concluido SET DEFAULT false;
ALTER TABLE public.kanban_cards
  ALTER COLUMN arquivado SET DEFAULT false;

NOTIFY pgrst, 'reload schema';
