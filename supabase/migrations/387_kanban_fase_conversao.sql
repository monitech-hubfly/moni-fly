-- 387: Fase de conversão — flag admin por fase (métricas futuras no painel)

ALTER TABLE public.kanban_fases
  ADD COLUMN IF NOT EXISTS fase_conversao BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.kanban_fases.fase_conversao IS
  'Marcada pelo admin como fase de conversão; usada em painéis analíticos.';
