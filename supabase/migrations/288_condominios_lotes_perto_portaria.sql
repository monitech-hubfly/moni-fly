-- 288: Atributo "Perto da portaria" em condominios_lotes.

ALTER TABLE public.condominios_lotes
  ADD COLUMN IF NOT EXISTS perto_portaria BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.condominios_lotes.perto_portaria IS 'Atributo do lote — perto da portaria.';
