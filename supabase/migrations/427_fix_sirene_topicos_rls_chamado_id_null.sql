-- 427: corrige policy sirene_topicos_all para reconhecer tópicos com chamado_id = NULL.
--
-- Contexto: migration 426 adicionou policy que resolve acesso via
--   sirene_chamados c WHERE c.id = sirene_topicos.chamado_id
-- Problema: criarSubInteracao sempre insere chamado_id = NULL (só preenche
--   interacao_id). Com NULL, o JOIN nunca retorna linhas → policy nega acesso
--   → 293 de 401 tópicos ficaram invisíveis em PROD.
--
-- Solução: dois caminhos de acesso:
--   (a) chamado_id preenchido → caminho direto (comportamento 426)
--   (b) chamado_id NULL + interacao_id preenchido → resolve chamado via
--         kanban_atividades.sirene_chamado_id → sirene_chamados

DROP POLICY IF EXISTS "sirene_topicos_all" ON public.sirene_topicos;
CREATE POLICY "sirene_topicos_all"
  ON public.sirene_topicos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sirene_chamados c
      WHERE (
        -- caminho (a): chamado_id direto
        c.id = sirene_topicos.chamado_id
        OR
        -- caminho (b): resolve via interacao_id → kanban_atividades → sirene_chamado
        (
          sirene_topicos.chamado_id IS NULL
          AND EXISTS (
            SELECT 1 FROM public.kanban_atividades ka
            WHERE ka.id    = sirene_topicos.interacao_id
              AND ka.sirene_chamado_id = c.id
          )
        )
      )
      AND (
        c.aberto_por = auth.uid()
        OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
        OR public.user_has_topic_on_chamado(c.id, auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'team')
        )
      )
    )
  );

NOTIFY pgrst, 'reload schema';
