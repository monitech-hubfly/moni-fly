-- =============================================================================
-- Fix DEV: permission denied for table listings_casas (Mapa de Competidores)
-- Idempotente — cole no Supabase SQL Editor do projeto DEV
-- Equivalente a supabase/migrations/370_listings_casas_grants_staff_rls.sql
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings_casas TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings_lotes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lote_escolhido TO authenticated, service_role;

DROP POLICY IF EXISTS "Staff listings_casas" ON public.listings_casas;
CREATE POLICY "Staff listings_casas"
  ON public.listings_casas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = listings_casas.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles pf
          WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor')
        )
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards k
      WHERE k.franqueado_id = auth.uid()
        AND (
          k.processo_step_one_id = listings_casas.processo_id
          OR k.projeto_id = listings_casas.processo_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = listings_casas.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles pf
          WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor')
        )
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards k
      WHERE k.franqueado_id = auth.uid()
        AND (
          k.processo_step_one_id = listings_casas.processo_id
          OR k.projeto_id = listings_casas.processo_id
        )
    )
  );

NOTIFY pgrst, 'reload schema';
