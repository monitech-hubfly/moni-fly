-- Frank lê só cards de Portfólio e Operações da própria rede.
-- Não ganha INSERT/UPDATE/DELETE em kanban_cards.

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
    OR (
      franqueado_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('frank', 'franqueado')
      )
    )
    OR (
      rede_franqueado_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('frank', 'franqueado')
          AND p.rede_franqueado_id = kanban_cards.rede_franqueado_id
      )
      AND EXISTS (
        SELECT 1 FROM public.kanbans k
        WHERE k.id = kanban_cards.kanban_id
          AND k.nome IN ('Funil Portfólio', 'Funil Operações')
      )
    )
  );

-- Escrita do dono (101). Staff continua em kanban_cards_*_staff (366).
DROP POLICY IF EXISTS "kanban_cards_insert" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_update" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_delete" ON public.kanban_cards;

DROP POLICY IF EXISTS kanban_card_comentarios_select ON public.kanban_card_comentarios;
CREATE POLICY kanban_card_comentarios_select
  ON public.kanban_card_comentarios
  FOR SELECT
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid()
          AND pr.role IN ('admin', 'team', 'consultor', 'supervisor')
      )
      AND (
        EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = kanban_card_comentarios.card_id)
        OR EXISTS (
          SELECT 1 FROM public.processo_step_one p
          WHERE p.id = kanban_card_comentarios.card_id
            AND (
              p.user_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.profiles pr
                WHERE pr.id = auth.uid()
                  AND pr.role = ANY (ARRAY['admin','team'])
              )
            )
        )
        OR (
          kanban_card_comentarios.sirene_chamado_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.profiles pr
            WHERE pr.id = auth.uid()
              AND pr.role = ANY (ARRAY['admin','team','consultor','supervisor'])
          )
        )
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.kanban_cards c
      JOIN public.kanbans k ON k.id = c.kanban_id
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = kanban_card_comentarios.card_id
        AND p.role IN ('frank', 'franqueado')
        AND p.rede_franqueado_id IS NOT NULL
        AND c.rede_franqueado_id = p.rede_franqueado_id
        AND k.nome IN ('Funil Portfólio', 'Funil Operações')
    )
  );

NOTIFY pgrst, 'reload schema';
