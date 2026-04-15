-- ========================================
-- DESABILITAR RLS EM TODAS AS TABELAS (TEMPORÁRIO)
-- Execute no Supabase Dashboard > SQL Editor
-- ========================================

-- ATENÇÃO: Use apenas em DESENVOLVIMENTO!
-- Isso remove toda a segurança RLS para debug

-- Tabelas do Kanban
ALTER TABLE public.kanban_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanbans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_fases DISABLE ROW LEVEL SECURITY;

-- Tabelas de Processos
ALTER TABLE public.processo_step_one DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_card_checklist DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_card_comite DISABLE ROW LEVEL SECURITY;

-- Tabelas de Perfis (se existir RLS)
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Verificar que RLS foi desabilitado
SELECT 
  tablename,
  rowsecurity as rls_ativo
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'kanban_cards', 
    'kanbans', 
    'kanban_fases',
    'processo_step_one',
    'processo_card_checklist'
  )
ORDER BY tablename;

-- ✅ Se aparecer 'false' para todas, o RLS foi desabilitado
-- Agora atualize a página e os cards devem aparecer!
