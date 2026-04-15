-- ========================================
-- DESABILITAR RLS TEMPORARIAMENTE (APENAS PARA DEBUG)
-- Execute no Supabase Dashboard > SQL Editor
-- ========================================

-- ATENÇÃO: Isso remove a segurança temporariamente!
-- Use apenas em desenvolvimento para ver os cards
-- Depois execute REABILITAR_RLS.sql para voltar a segurança

ALTER TABLE public.kanban_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanbans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_fases DISABLE ROW LEVEL SECURITY;

SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('kanban_cards', 'kanbans', 'kanban_fases');

-- Agora atualize a página e os cards devem aparecer!
