-- 482: kanban_atividades SELECT — adiciona team e supervisor
DROP POLICY IF EXISTS kanban_atividades_select ON public.kanban_atividades;
CREATE POLICY kanban_atividades_select ON public.kanban_atividades
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor', 'team', 'supervisor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
    OR kanban_atividades.responsavel_id = auth.uid()
    OR (
      kanban_atividades.responsaveis_ids IS NOT NULL
      AND kanban_atividades.responsaveis_ids @> ARRAY[auth.uid()]
    )
    OR user_is_responsavel_topico_da_atividade(id, auth.uid())
  );
NOTIFY pgrst, 'reload schema';
