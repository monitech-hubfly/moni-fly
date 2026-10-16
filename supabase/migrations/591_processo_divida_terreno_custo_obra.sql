-- 591: Dados do Negócio — Dívida terreno, Custo da Obra e Dívida Obra.
-- Idempotente. Não apaga colunas existentes.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS divida_terreno text,
  ADD COLUMN IF NOT EXISTS custo_obra text,
  ADD COLUMN IF NOT EXISTS divida_obra text;

COMMENT ON COLUMN public.processo_step_one.divida_terreno IS
  'Dívida terreno. Texto livre no mesmo formato de valor do terreno.';
COMMENT ON COLUMN public.processo_step_one.custo_obra IS
  'Custo da Obra. Texto livre no mesmo formato de valor do terreno.';
COMMENT ON COLUMN public.processo_step_one.divida_obra IS
  'Dívida Obra. Texto livre no mesmo formato de valor do terreno.';

NOTIFY pgrst, 'reload schema';
