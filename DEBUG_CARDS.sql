-- ========================================
-- DEBUG: Verificar por que os cards não aparecem
-- Execute no Supabase Dashboard > SQL Editor
-- ========================================

-- 1. Verificar se o Kanban existe
SELECT 
  'KANBAN' as tipo,
  id,
  nome,
  ativo
FROM public.kanbans
WHERE nome = 'Funil Step One';

-- 2. Verificar se as fases existem
SELECT 
  'FASES' as tipo,
  f.id,
  f.nome,
  f.ordem,
  f.ativo,
  k.nome as kanban_nome
FROM public.kanban_fases f
JOIN public.kanbans k ON f.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
ORDER BY f.ordem;

-- 3. Verificar se os cards existem e seus detalhes
SELECT 
  'CARDS' as tipo,
  c.id,
  c.titulo,
  c.status,
  c.franqueado_id,
  c.fase_id,
  c.kanban_id,
  c.created_at,
  f.nome as fase_nome,
  k.nome as kanban_nome,
  p.email as email_responsavel,
  p.role as role_responsavel
FROM public.kanban_cards c
JOIN public.kanban_fases f ON c.fase_id = f.id
JOIN public.kanbans k ON c.kanban_id = k.id
LEFT JOIN public.profiles p ON c.franqueado_id = p.id
WHERE k.nome = 'Funil Step One'
ORDER BY c.created_at DESC;

-- 4. Verificar seu próprio perfil
SELECT 
  'MEU_PERFIL' as tipo,
  id,
  email,
  role,
  full_name
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;

-- 5. Testar a policy RLS manualmente
-- Ver se você consegue ver os cards com sua sessão
SET LOCAL ROLE authenticated;
SELECT 
  'TESTE_RLS' as tipo,
  c.id,
  c.titulo,
  c.franqueado_id
FROM public.kanban_cards c
JOIN public.kanbans k ON c.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
  AND c.status = 'ativo';
RESET ROLE;
