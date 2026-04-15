-- ========================================
-- REABILITAR RLS (Depois do debug)
-- Execute no Supabase Dashboard > SQL Editor
-- ========================================

ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanbans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_fases ENABLE ROW LEVEL SECURITY;

-- Verificar que RLS está ativo
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('kanban_cards', 'kanbans', 'kanban_fases');
