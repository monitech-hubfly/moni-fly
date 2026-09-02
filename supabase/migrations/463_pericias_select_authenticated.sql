-- =============================================================================
-- Migration: 463_pericias_select_authenticated
-- Problema: RLS bloqueava listPericiasParaSelect para usuários sem sirene_papeis,
--           retornando [] silenciosamente no select de vínculo chamado→perícia.
-- Solução: SELECT aberto para todos autenticados (escrita continua restrita).
-- =============================================================================
DROP POLICY IF EXISTS "pericias_select_authenticated" ON sirene_pericias;
CREATE POLICY "pericias_select_authenticated"
  ON sirene_pericias
  FOR SELECT
  TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
