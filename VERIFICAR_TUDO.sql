-- ========================================
-- VERIFICAR TUDO: RLS, Cards, Policies
-- Execute no Supabase Dashboard > SQL Editor
-- ========================================

-- 1. Verificar se RLS está desabilitado
SELECT 
  tablename,
  rowsecurity as rls_ativo
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('kanban_cards', 'kanbans', 'kanban_fases')
ORDER BY tablename;

-- 2. Contar cards sem RLS (com privilégio de admin do SQL Editor)
SELECT 
  'Total de cards' as tipo,
  COUNT(*) as quantidade
FROM public.kanban_cards c
JOIN public.kanbans k ON c.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
  AND c.status = 'ativo';

-- 3. Listar todos os cards (bypassa RLS no SQL Editor)
SELECT 
  c.id,
  c.titulo,
  c.status,
  c.franqueado_id,
  f.nome as fase,
  c.created_at,
  EXTRACT(DAY FROM (NOW() - c.created_at)) as dias_desde_criacao
FROM public.kanban_cards c
JOIN public.kanban_fases f ON c.fase_id = f.id
JOIN public.kanbans k ON c.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
  AND c.status = 'ativo'
ORDER BY f.ordem, c.created_at DESC;

-- 4. Verificar se a tabela kanban_cards tem permissões
SELECT 
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'kanban_cards'
  AND grantee IN ('authenticated', 'anon', 'service_role');
