-- 426: admin e team passam a ver todos os chamados Sirene, tópicos, anexos e mensagens.
--
-- Contexto: as policies anteriores (migration 037) só permitiam acesso a:
--   (a) quem abriu o chamado (aberto_por)
--   (b) bombeiro / caneta_verde (sirene_papeis)
--   (c) quem tem tópico atribuído (user_has_topic_on_chamado)
--
-- Isso bloqueava usuários com role admin/team que não se enquadravam em nenhuma
-- das condições acima, mesmo que precisassem acompanhar ou auditar o chamado.
-- Exemplo reportado: usuário não conseguia ver anexo de atividade no chamado #0578.
--
-- Não existe conceito de "chamado sigiloso" em Sirene — verificado em toda a base
-- de código. A expansão é segura para todos os chamados.
--
-- Função user_has_topic_on_chamado (criada na 037) é mantida sem alteração.

-- ── sirene_chamados: SELECT ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "sirene_chamados_select" ON public.sirene_chamados;
CREATE POLICY "sirene_chamados_select"
  ON public.sirene_chamados FOR SELECT
  USING (
    aberto_por = auth.uid()
    OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
    OR public.user_has_topic_on_chamado(sirene_chamados.id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'team')
    )
  );

-- ── sirene_topicos: ALL ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sirene_topicos_all" ON public.sirene_topicos;
CREATE POLICY "sirene_topicos_all"
  ON public.sirene_topicos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sirene_chamados c
      WHERE c.id = sirene_topicos.chamado_id
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

-- ── sirene_anexos: ALL ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sirene_anexos_all" ON public.sirene_anexos;
CREATE POLICY "sirene_anexos_all"
  ON public.sirene_anexos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sirene_chamados c
      WHERE c.id = sirene_anexos.chamado_id
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

-- ── sirene_mensagens: SELECT ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "sirene_mensagens_select" ON public.sirene_mensagens;
CREATE POLICY "sirene_mensagens_select"
  ON public.sirene_mensagens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sirene_chamados c
      WHERE c.id = sirene_mensagens.chamado_id
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
