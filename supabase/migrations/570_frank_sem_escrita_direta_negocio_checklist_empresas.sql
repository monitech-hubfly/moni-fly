-- Frank/franqueado não grava direto em negócio, checklist da fase, empresas nem condomínio.
-- Leitura própria permanece. Escrita desses blocos fica para card_edicoes_pendentes.

DROP POLICY IF EXISTS "Frank sees own processes" ON public.processo_step_one;
CREATE POLICY "Frank sees own processes"
  ON public.processo_step_one
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('frank', 'franqueado')
    )
  );

DROP POLICY IF EXISTS "fase_checklist_resp_upsert" ON public.kanban_fase_checklist_respostas;
CREATE POLICY "fase_checklist_resp_upsert"
  ON public.kanban_fase_checklist_respostas
  FOR ALL
  TO authenticated
  USING (
    auth.role() = 'authenticated'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('frank', 'franqueado')
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('frank', 'franqueado')
    )
  );

DROP POLICY IF EXISTS "allow_all_franqueado_empresas" ON public.franqueado_empresas;
CREATE POLICY "allow_all_franqueado_empresas"
  ON public.franqueado_empresas
  FOR ALL
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('frank', 'franqueado')
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('frank', 'franqueado')
    )
  );

DROP POLICY IF EXISTS "condominios_insert_authenticated" ON public.condominios;
CREATE POLICY "condominios_insert_authenticated"
  ON public.condominios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    trim(nome) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('frank', 'franqueado')
    )
  );

DROP POLICY IF EXISTS "condominios_update_recuos_authenticated" ON public.condominios;
CREATE POLICY "condominios_update_recuos_authenticated"
  ON public.condominios
  FOR UPDATE
  TO authenticated
  USING (
    auth.role() = 'authenticated'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('frank', 'franqueado')
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('frank', 'franqueado')
    )
  );

NOTIFY pgrst, 'reload schema';
