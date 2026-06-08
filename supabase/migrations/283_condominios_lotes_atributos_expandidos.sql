-- 283: Atributos adicionais de lote (topografia, mata, lago) em condominios_lotes.

ALTER TABLE public.condominios_lotes
  ADD COLUMN IF NOT EXISTS terreno_plano BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terreno_aclive BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terreno_aclive_acentuado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terreno_declive BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terreno_declive_acentuado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fundo_mata BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frente_mata BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perto_lago BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fundo_lago BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frente_lago BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.condominios_lotes.terreno_plano IS 'Atributo do lote — terreno plano.';
COMMENT ON COLUMN public.condominios_lotes.terreno_aclive IS 'Atributo do lote — terreno em aclive.';
COMMENT ON COLUMN public.condominios_lotes.terreno_aclive_acentuado IS 'Atributo do lote — terreno em aclive acentuado.';
COMMENT ON COLUMN public.condominios_lotes.terreno_declive IS 'Atributo do lote — terreno em declive.';
COMMENT ON COLUMN public.condominios_lotes.terreno_declive_acentuado IS 'Atributo do lote — terreno em declive acentuado.';
COMMENT ON COLUMN public.condominios_lotes.fundo_mata IS 'Atributo do lote — fundo para mata.';
COMMENT ON COLUMN public.condominios_lotes.frente_mata IS 'Atributo do lote — frente para mata.';
COMMENT ON COLUMN public.condominios_lotes.perto_lago IS 'Atributo do lote — perto do lago.';
COMMENT ON COLUMN public.condominios_lotes.fundo_lago IS 'Atributo do lote — fundo para lago.';
COMMENT ON COLUMN public.condominios_lotes.frente_lago IS 'Atributo do lote — frente para lago.';
