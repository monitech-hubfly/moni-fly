-- =============================================================================
-- Migration: 461_pericias_rls_profiles_role_fallback
-- Problema: get_my_sirene_papel() só lê sirene_papeis. Membros do time sem
--           papel Sirene ficavam com NULL e não viam nenhuma perícia.
-- Solução: adicionar políticas que checam profiles.role diretamente.
-- Idempotente: sim (DROP IF EXISTS antes de cada CREATE)
-- =============================================================================

DROP POLICY IF EXISTS pericias_staff_profiles ON sirene_pericias;
CREATE POLICY pericias_staff_profiles ON sirene_pericias FOR ALL
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','team','consultor','supervisor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','team','consultor','supervisor')));

DROP POLICY IF EXISTS pericia_acoes_staff_profiles ON sirene_pericia_acoes;
CREATE POLICY pericia_acoes_staff_profiles ON sirene_pericia_acoes FOR ALL
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','team','consultor','supervisor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','team','consultor','supervisor')));

DROP POLICY IF EXISTS pericia_chamados_staff_profiles ON sirene_pericia_chamados;
CREATE POLICY pericia_chamados_staff_profiles ON sirene_pericia_chamados FOR ALL
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','team','consultor','supervisor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','team','consultor','supervisor')));

DROP POLICY IF EXISTS carometro_vinculos_staff_profiles ON sirene_pericia_carometro_vinculos;
CREATE POLICY carometro_vinculos_staff_profiles ON sirene_pericia_carometro_vinculos FOR ALL
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','team','consultor','supervisor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','team','consultor','supervisor')));

DROP POLICY IF EXISTS pericia_historico_staff_profiles ON sirene_pericia_historico;
CREATE POLICY pericia_historico_staff_profiles ON sirene_pericia_historico FOR ALL
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','team','consultor','supervisor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','team','consultor','supervisor')));

NOTIFY pgrst, 'reload schema';
