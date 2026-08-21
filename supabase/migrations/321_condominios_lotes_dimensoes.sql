-- 321: Dimensões do lote (frente, fundo, lados) em condominios_lotes.

ALTER TABLE public.condominios_lotes
  ADD COLUMN IF NOT EXISTS dimensao_frente_m NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS dimensao_fundo_m NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS dimensao_lado_direito_m NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS dimensao_lado_esquerdo_m NUMERIC(10, 2);

COMMENT ON COLUMN public.condominios_lotes.dimensao_frente_m IS
  'Dimensão da frente do lote em metros (Funil Step One — Lotes Disponíveis).';
COMMENT ON COLUMN public.condominios_lotes.dimensao_fundo_m IS
  'Dimensão do fundo do lote em metros (Funil Step One — Lotes Disponíveis).';
COMMENT ON COLUMN public.condominios_lotes.dimensao_lado_direito_m IS
  'Dimensão do lado direito do lote em metros (Funil Step One — Lotes Disponíveis).';
COMMENT ON COLUMN public.condominios_lotes.dimensao_lado_esquerdo_m IS
  'Dimensão do lado esquerdo do lote em metros (Funil Step One — Lotes Disponíveis).';
