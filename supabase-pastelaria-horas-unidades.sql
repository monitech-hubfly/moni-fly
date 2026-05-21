-- =============================================================================
-- Pastelaria — unidade por dia em pastelaria_horas (Supabase SQL Editor)
-- Depois: NOTIFY pgrst, 'reload schema';
-- =============================================================================

ALTER TABLE pastelaria_horas
  ADD COLUMN IF NOT EXISTS seg_unidade text DEFAULT 'h',
  ADD COLUMN IF NOT EXISTS ter_unidade text DEFAULT 'h',
  ADD COLUMN IF NOT EXISTS qua_unidade text DEFAULT 'h',
  ADD COLUMN IF NOT EXISTS qui_unidade text DEFAULT 'h',
  ADD COLUMN IF NOT EXISTS sex_unidade text DEFAULT 'h';
