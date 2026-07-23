-- 471: adiciona condição à policy SELECT de kanban_atividades para cobrir
-- responsáveis em sirene_topicos vinculados via interacao_id.
--
-- Problema: getTopicosChamado faz duas queries sequenciais:
--   (1) sirene_topicos WHERE chamado_id = X  → não encontra tópicos com chamado_id NULL
--   (2) kanban_atividades WHERE sirene_chamado_id = X  → lida como o usuário
--       Se o usuário só é responsável no tópico (não na ka), RLS nega
--       → interacaoIds = [] → query de tópicos via interacao_id nunca roda → 0 resultados
--
-- Fix: adicionar condição 6 ao SELECT de kanban_atividades — sem remover nenhuma
-- das 5 condições existentes (admin/consultor, franqueado_id, legado, responsavel_id,
-- responsaveis_ids). Verificado condição por condição: todas presentes.

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
    -- Condição 6 (nova): responsável em sirene_topico vinculado via interacao_id
    -- Cobre o caso onde o usuário é atribuído no tópico Sirene mas não na ka em si.
    OR EXISTS (
      SELECT 1 FROM public.sirene_topicos t
      WHERE t.interacao_id = kanban_atividades.id
        AND (
          t.responsavel_id = auth.uid()
          OR auth.uid() = ANY(COALESCE(t.responsaveis_ids, '{}'))
        )
    )
  );

NOTIFY pgrst, 'reload schema';
