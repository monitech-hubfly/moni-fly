-- 20260729160000: fix RLS sirene_topicos — eliminar user_has_topic_on_interacao (causa de timeout)
--
-- Problema: migration 20260729150000 adicionou Branch 2 que chama
--   user_has_topic_on_interacao(ka.id, auth.uid()) — função SECURITY DEFINER que
--   faz SELECT em sirene_topicos de dentro da policy de sirene_topicos.
--   Para cada linha avaliada pela policy, a função scaneia sirene_topicos novamente.
--   Isso é O(N²) → statement timeout em PROD.
--
--   Adicionalmente, a condição admin/team (F) ficava enterrada dentro de EXISTS
--   (sirene_chamados), sem garantia de short-circuit pelo planner. Para usuários
--   admin, a policy percorria o EXISTS caro antes de encontrar a condição de role.
--
-- Condições de 20260729150000 preservadas:
--   A) c.id = sirene_topicos.chamado_id
--   B) chamado_id IS NULL AND ka.sirene_chamado_id = c.id
--   C) c.aberto_por = auth.uid()
--   D) get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
--   E) user_has_topic_on_chamado(c.id, auth.uid())
--   F) role IN ('admin', 'team')  ← movida para topo (fast-path garantido)
--   G1) ka.criado_por = auth.uid()
--   G2) ka.responsavel_id = auth.uid()
--   G3) auth.uid() = ANY(ka.responsaveis_ids)
--
-- Condição REMOVIDA por causar timeout O(N²):
--   G4) user_has_topic_on_interacao(ka.id, auth.uid())
--       → O tópico avaliado pela policy JÁ é o tópico com interacao_id = ka.id.
--         Se o usuário é responsável por ele, as novas condições H/I diretas cobrem.
--         O caso extra (outro tópico na mesma interação) não justifica O(N²).
--
-- Condições NOVAS para fast-path sem JOIN:
--   H) sirene_topicos.responsavel_id = auth.uid()
--   I) auth.uid() = ANY(COALESCE(sirene_topicos.responsaveis_ids, '{}'))
--   Cobertas antes pelos EXISTS — agora avaliadas direto, com possibilidade de
--   index scan em responsavel_id.

DROP POLICY IF EXISTS "sirene_topicos_all" ON public.sirene_topicos;
CREATE POLICY "sirene_topicos_all"
  ON public.sirene_topicos FOR ALL
  USING (
    -- (H) Fast-path direto: usuário é responsavel_id do tópico
    sirene_topicos.responsavel_id = auth.uid()
    OR
    -- (I) Fast-path direto: usuário está em responsaveis_ids
    auth.uid() = ANY(COALESCE(sirene_topicos.responsaveis_ids, '{}'))
    OR
    -- (F) Admin/team bypass — avaliado antes dos EXISTS caros
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id   = auth.uid()
        AND role IN ('admin', 'team')
    )
    OR
    -- Branch 1: tópico ligado a sirene_chamados (condições A+B+C+D+E intactas de 427)
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
            WHERE ka.id                = sirene_topicos.interacao_id
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
      )
    )
    OR
    -- Branch 2 (G1+G2+G3): chamado nativo — sem user_has_topic_on_interacao
    (
      sirene_topicos.chamado_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.kanban_atividades ka
        WHERE ka.id                = sirene_topicos.interacao_id
          AND ka.sirene_chamado_id IS NULL
          AND (
            -- (G1)
            ka.criado_por    = auth.uid()
            -- (G2)
            OR ka.responsavel_id = auth.uid()
            -- (G3)
            OR auth.uid() = ANY(COALESCE(ka.responsaveis_ids, '{}'))
          )
      )
    )
  );

NOTIFY pgrst, 'reload schema';
