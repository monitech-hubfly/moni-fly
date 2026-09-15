-- 551: Área do lote no cadastro do template (accordion Lista de Lotes no card).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Não aplicar em PROD sem revisão da Ingrid.

ALTER TABLE public.lotes_template
  ADD COLUMN IF NOT EXISTS area_m2 numeric(12, 2);

COMMENT ON COLUMN public.lotes_template.area_m2 IS
  'Área do lote em m², exibida na Lista de Lotes do card do Funil Loteadores.';

NOTIFY pgrst, 'reload schema';
