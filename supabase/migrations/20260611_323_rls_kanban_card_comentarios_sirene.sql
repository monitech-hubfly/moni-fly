-- Migration 323: Permite leitura de comentários de chamados Sirene diretos (sirene_chamado_id IS NOT NULL)
-- para roles admin, team, consultor e supervisor.

DROP POLICY IF EXISTS kanban_card_comentarios_select ON public.kanban_card_comentarios;
CREATE POLICY kanban_card_comentarios_select ON public.kanban_card_comentarios
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = kanban_card_comentarios.card_id)
    OR EXISTS (
      SELECT 1 FROM processo_step_one p
      WHERE p.id = kanban_card_comentarios.card_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles pr
            WHERE pr.id = auth.uid()
              AND pr.role = ANY (ARRAY['admin','team'])
          )
        )
    )
    OR (
      kanban_card_comentarios.sirene_chamado_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM profiles pr
        WHERE pr.id = auth.uid()
          AND pr.role = ANY (ARRAY['admin','team','consultor','supervisor'])
      )
    )
  );
