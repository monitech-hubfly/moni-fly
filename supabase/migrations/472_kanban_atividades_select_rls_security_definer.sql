-- 472: substitui condição 6 da policy kanban_atividades_select (migration 471)
-- por chamada a função SECURITY DEFINER, eliminando risco de recursão infinita.
--
-- Problema com 471: EXISTS direto em sirene_topicos passa pela RLS sirene_topicos_all,
-- que por sua vez faz EXISTS em kanban_atividades (path b, migration 427) →
-- avalia kanban_atividades_select → avalia sirene_topicos_all → ciclo infinito.
--
-- Solução: SECURITY DEFINER (owner postgres, BYPASSRLS=true) lê sirene_topicos
-- sem avaliar nenhuma policy → ciclo impossível.
-- Mesmo padrão de user_has_topic_on_chamado (migration 037).
--
-- Condições 1–5 da policy: mantidas sem alteração (verificado vs migration 465).

CREATE OR REPLACE FUNCTION public.user_is_responsavel_topico_da_atividade(
  p_atividade_id uuid,
  p_user_id     uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sirene_topicos t
    WHERE t.interacao_id = p_atividade_id
      AND (
        t.responsavel_id = p_user_id
        OR p_user_id = ANY(COALESCE(t.responsaveis_ids, '{}'))
      )
  );
$$;

DROP POLICY IF EXISTS kanban_atividades_select ON public.kanban_atividades;
CREATE POLICY kanban_atividades_select ON public.kanban_atividades
  FOR SELECT
  USING (
    -- Condição 1: admin ou consultor
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    -- Condição 2: dono do card (franqueado)
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    -- Condição 3: processo legado (step_one)
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
    -- Condição 4: responsável direto (scalar)
    OR kanban_atividades.responsavel_id = auth.uid()
    -- Condição 5: responsável em array
    OR (
      kanban_atividades.responsaveis_ids IS NOT NULL
      AND kanban_atividades.responsaveis_ids @> ARRAY[auth.uid()]
    )
    -- Condição 6: responsável em sirene_topico vinculado via interacao_id
    -- SECURITY DEFINER bypassa RLS de sirene_topicos → sem recursão.
    OR public.user_is_responsavel_topico_da_atividade(kanban_atividades.id, auth.uid())
  );

NOTIFY pgrst, 'reload schema';
