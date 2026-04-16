-- ─── 121: sirene_topicos como sub-interação só de kanban (sem chamado) ───────
-- Permite chamado_id NULL quando interacao_id aponta para kanban_atividades.
-- Ajusta RLS para linhas vinculadas a interação (acesso alinhado ao card/atividade).

ALTER TABLE public.sirene_topicos
  ALTER COLUMN chamado_id DROP NOT NULL;

COMMENT ON COLUMN public.sirene_topicos.chamado_id IS
  'Chamado Sirene (legado). NULL quando o tópico é sub-interação de kanban_atividades (interacao_id).';

ALTER TABLE public.sirene_topicos
  DROP CONSTRAINT IF EXISTS sirene_topicos_chamado_ou_interacao_chk;

ALTER TABLE public.sirene_topicos
  ADD CONSTRAINT sirene_topicos_chamado_ou_interacao_chk
  CHECK (chamado_id IS NOT NULL OR interacao_id IS NOT NULL);

DROP POLICY IF EXISTS "sirene_topicos_all" ON public.sirene_topicos;

CREATE POLICY "sirene_topicos_all"
  ON public.sirene_topicos FOR ALL
  USING (
    (
      sirene_topicos.chamado_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM   public.sirene_chamados c
        WHERE  c.id = sirene_topicos.chamado_id
          AND (
            c.aberto_por = auth.uid()
            OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
            OR public.user_has_topic_on_chamado(c.id, auth.uid())
          )
      )
    )
    OR (
      sirene_topicos.interacao_id IS NOT NULL
      AND (
        auth.uid() = ANY (COALESCE(sirene_topicos.responsaveis_ids, '{}'))
        OR sirene_topicos.responsavel_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM   public.kanban_atividades a
          WHERE  a.id = sirene_topicos.interacao_id
            AND (
              EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role IN ('admin', 'consultor')
              )
              OR EXISTS (
                SELECT 1 FROM public.kanban_cards kc
                WHERE kc.id = a.card_id
                  AND a.origem = 'nativo'
                  AND kc.franqueado_id = auth.uid()
              )
              OR (
                a.origem = 'legado'
                AND EXISTS (
                  SELECT 1 FROM public.processo_step_one p
                  WHERE p.id = a.card_id
                    AND p.user_id = auth.uid()
                )
              )
              OR a.responsavel_id = auth.uid()
              OR auth.uid() = ANY (COALESCE(a.responsaveis_ids, '{}'))
              OR a.criado_por = auth.uid()
            )
        )
      )
    )
  );
