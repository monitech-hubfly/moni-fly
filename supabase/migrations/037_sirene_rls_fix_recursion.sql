-- Corrige recursão infinita nas políticas RLS: sirene_chamados e sirene_topicos
-- referenciam um ao outro. Usamos uma função SECURITY DEFINER que consulta
-- sirene_topicos sem passar por RLS, quebrando o ciclo.

CREATE OR REPLACE FUNCTION public.user_has_topic_on_chamado(p_chamado_id bigint, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sirene_topicos t
    LEFT JOIN public.profiles p ON p.id = p_user_id
    WHERE t.chamado_id = p_chamado_id
      AND (t.responsavel_id = p_user_id OR t.time_responsavel = p.full_name)
  );
$$;

-- Recria políticas de sirene_chamados usando a função (sem SELECT em sirene_topicos)
DROP POLICY IF EXISTS "sirene_chamados_select" ON public.sirene_chamados;
CREATE POLICY "sirene_chamados_select"
  ON public.sirene_chamados FOR SELECT
  USING (
    aberto_por = auth.uid()
    OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
    OR public.user_has_topic_on_chamado(sirene_chamados.id, auth.uid())
  );

DROP POLICY IF EXISTS "sirene_chamados_update" ON public.sirene_chamados;
CREATE POLICY "sirene_chamados_update"
  ON public.sirene_chamados FOR UPDATE
  USING (
    aberto_por = auth.uid()
    OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
    OR public.user_has_topic_on_chamado(sirene_chamados.id, auth.uid())
  );

-- Recria política de sirene_topicos: só consulta sirene_chamados (que não consulta sirene_topicos nas políticas)
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
        )
    )
  );

-- Anexos e mensagens: mesma lógica, sem EXISTS em sirene_topicos
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
        )
    )
  );

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
        )
    )
  );
