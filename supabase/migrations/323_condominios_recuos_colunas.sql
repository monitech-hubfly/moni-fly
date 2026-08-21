-- 323: Recuos obrigatórios no cadastro central de condomínios (Pré Batalha / elegibilidade geométrica).

ALTER TABLE public.condominios
  ADD COLUMN IF NOT EXISTS recuo_frontal_m NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS recuo_fundo_m NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS recuo_lateral_m NUMERIC(8, 2);

COMMENT ON COLUMN public.condominios.recuo_frontal_m IS 'Recuo frontal obrigatório do condomínio (m).';
COMMENT ON COLUMN public.condominios.recuo_fundo_m IS 'Recuo de fundo obrigatório do condomínio (m).';
COMMENT ON COLUMN public.condominios.recuo_lateral_m IS 'Recuo lateral obrigatório (m) — aplica-se a ambos os lados.';

-- Franqueados preenchem recuos na fase Dados do Condomínio (sync com condominios_lotes).
DROP POLICY IF EXISTS "condominios_update_recuos_authenticated" ON public.condominios;
CREATE POLICY "condominios_update_recuos_authenticated"
  ON public.condominios
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
