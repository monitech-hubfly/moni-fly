-- 20260729150000: sirene_topicos — Branch 2 para chamados de origem nativa
--
-- Problema: tópicos ligados a kanban_atividades com origem='nativo' e
-- sirene_chamado_id=NULL eram invisíveis via user client porque a policy
-- sirene_topicos_all (migration 427) só entra via sirene_chamados.
-- Nenhum branch cobria o caminho: topico.interacao_id → kanban_atividade
-- sem sirene_chamado_id. Resultado: "Nenhuma atividade registrada" mesmo
-- com tópicos não concluídos bloqueando a conclusão do chamado.
--
-- Solução: nova função SECURITY DEFINER + Branch 2 na policy.
-- Todas as condições de 427 são preservadas integralmente.

-- ── Função auxiliar (sem recursão de RLS) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_has_topic_on_interacao(
  p_interacao_id uuid,
  p_user_id      uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sirene_topicos t
    WHERE t.interacao_id = p_interacao_id
      AND t.arquivado    = false
      AND (
        t.responsavel_id = p_user_id
        OR p_user_id = ANY(COALESCE(t.responsaveis_ids, '{}'))
      )
  );
$$;

-- ── Policy sirene_topicos_all (reescreve 427, preserva todas as condições) ───
-- Condições preservadas de 427:
--   A) c.id = sirene_topicos.chamado_id
--   B) chamado_id IS NULL AND ka.sirene_chamado_id = c.id
--   C) c.aberto_por = auth.uid()
--   D) get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
--   E) user_has_topic_on_chamado(c.id, auth.uid())
--   F) role IN ('admin', 'team')
-- Nova condição adicionada:
--   G) Branch 2 — chamado nativo sem sirene_chamados entry
DROP POLICY IF EXISTS "sirene_topicos_all" ON public.sirene_topicos;
CREATE POLICY "sirene_topicos_all"
  ON public.sirene_topicos FOR ALL
  USING (
    -- Branch 1: tópico ligado a um sirene_chamado (condições A+B+C+D+E+F intactas)
    EXISTS (
      SELECT 1 FROM public.sirene_chamados c
      WHERE (
        -- (A) chamado_id direto
        c.id = sirene_topicos.chamado_id
        OR
        -- (B) resolve via interacao_id → kanban_atividades → sirene_chamado
        (
          sirene_topicos.chamado_id IS NULL
          AND EXISTS (
            SELECT 1 FROM public.kanban_atividades ka
            WHERE ka.id               = sirene_topicos.interacao_id
              AND ka.sirene_chamado_id = c.id
          )
        )
      )
      AND (
        -- (C)
        c.aberto_por = auth.uid()
        -- (D)
        OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
        -- (E)
        OR public.user_has_topic_on_chamado(c.id, auth.uid())
        -- (F)
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id   = auth.uid()
            AND role IN ('admin', 'team')
        )
      )
    )
    OR
    -- Branch 2 (G): chamado nativo — sem entrada em sirene_chamados
    (
      sirene_topicos.chamado_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.kanban_atividades ka
        WHERE ka.id               = sirene_topicos.interacao_id
          AND ka.sirene_chamado_id IS NULL
          AND (
            ka.criado_por    = auth.uid()
            OR ka.responsavel_id = auth.uid()
            OR auth.uid() = ANY(COALESCE(ka.responsaveis_ids, '{}'))
            OR public.user_has_topic_on_interacao(ka.id, auth.uid())
            OR EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id   = auth.uid()
                AND role IN ('admin', 'team')
            )
          )
      )
    )
  );

NOTIFY pgrst, 'reload schema';
