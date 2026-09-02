-- =============================================================================
-- Pastelaria — GRANTs (correção: permission denied for table pastelaria_cards)
-- Rode no Supabase → SQL Editor → Run se você já executou supabase-pastelaria.sql
-- sem a seção 4.1 de GRANTs.
-- Depois: NOTIFY pgrst, 'reload schema';
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pastelaria_cards TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pastelaria_horas TO anon, authenticated;
GRANT INSERT ON TABLE public.pastelaria_reclassificacoes TO authenticated;
GRANT INSERT ON TABLE public.pastelaria_log TO authenticated;

GRANT SELECT ON public.pastelaria_gantt_semanas TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
