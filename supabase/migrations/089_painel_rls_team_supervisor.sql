-- Time interno (team) e supervisor: mesma visão/gestão do painel que admin para processos e artefatos do card.
-- Corrige listagens agregadas (ex.: Painel de Tarefas) que dependem de SELECT sem filtro por processo.

-- processo_step_one: admin/time/supervisor veem e editam todos os processos
DROP POLICY IF EXISTS "Admin sees all processes" ON public.processo_step_one;
CREATE POLICY "Admin sees all processes" ON public.processo_step_one FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'team', 'supervisor')
  )
);

-- etapa_progresso: alinhar movimentação de etapas ao painel
DROP POLICY IF EXISTS "Admin all etapa_progresso" ON public.etapa_progresso;
CREATE POLICY "Admin all etapa_progresso" ON public.etapa_progresso FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'team', 'supervisor')
  )
);

-- Artefatos do card (mesma cláusula admin → admin|team|supervisor)
DROP POLICY IF EXISTS "processo_card_comentarios_all" ON public.processo_card_comentarios;
CREATE POLICY "processo_card_comentarios_all"
  ON public.processo_card_comentarios FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_comentarios.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor'))
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "processo_card_checklist_all" ON public.processo_card_checklist;
CREATE POLICY "processo_card_checklist_all"
  ON public.processo_card_checklist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_checklist.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor'))
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "processo_etapa_topicos_all" ON public.processo_etapa_topicos;
CREATE POLICY "processo_etapa_topicos_all"
  ON public.processo_etapa_topicos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_etapa_topicos.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor'))
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "processo_etapa_topicos_anexos_all" ON public.processo_etapa_topicos_anexos;
CREATE POLICY "processo_etapa_topicos_anexos_all"
  ON public.processo_etapa_topicos_anexos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_etapa_topicos t
      JOIN public.processo_step_one p ON p.id = t.processo_id
      WHERE t.id = processo_etapa_topicos_anexos.topico_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor'))
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "processo_card_documentos_all" ON public.processo_card_documentos;
CREATE POLICY "processo_card_documentos_all"
  ON public.processo_card_documentos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_documentos.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor'))
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "processo_card_eventos_select" ON public.processo_card_eventos;
CREATE POLICY "processo_card_eventos_select" ON public.processo_card_eventos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_eventos.processo_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor'))
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS "processo_card_eventos_insert" ON public.processo_card_eventos;
CREATE POLICY "processo_card_eventos_insert" ON public.processo_card_eventos
  FOR INSERT
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_eventos.processo_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor'))
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS "processo_card_comite_all" ON public.processo_card_comite;
CREATE POLICY "processo_card_comite_all"
  ON public.processo_card_comite FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.processo_step_one p
      WHERE p.id = processo_card_comite.processo_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor'))
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS "processo_card_checklist_pareceres_all" ON public.processo_card_checklist_pareceres;
CREATE POLICY "processo_card_checklist_pareceres_all"
  ON public.processo_card_checklist_pareceres FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.processo_card_checklist c
      JOIN public.processo_step_one p ON p.id = c.processo_id
      WHERE c.id = processo_card_checklist_pareceres.checklist_item_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor'))
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS "processo_card_checklist_legal_all" ON public.processo_card_checklist_legal;
CREATE POLICY "processo_card_checklist_legal_all"
  ON public.processo_card_checklist_legal FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_checklist_legal.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor'))
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "processo_step1_area_checklist_all" ON public.processo_step1_area_checklist;
CREATE POLICY "processo_step1_area_checklist_all"
  ON public.processo_step1_area_checklist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_step1_area_checklist.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor'))
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );
