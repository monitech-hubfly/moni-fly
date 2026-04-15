-- ========================================
-- VER E CONSERTAR CARDS DO FUNIL STEP ONE
-- Execute no Supabase Dashboard > SQL Editor
-- ========================================

-- PASSO 1: Ver qual é o seu user_id
-- Copie o ID que aparecer aqui (você vai precisar dele)
SELECT 
  id as "SEU_USER_ID",
  email,
  role,
  full_name
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;

-- PASSO 2: Ver os cards existentes e quem é o dono atual
SELECT 
  c.id as card_id,
  c.titulo,
  c.franqueado_id as dono_atual,
  p.email as email_dono,
  f.nome as fase
FROM public.kanban_cards c
JOIN public.kanban_fases f ON c.fase_id = f.id
JOIN public.kanbans k ON c.kanban_id = k.id
LEFT JOIN public.profiles p ON c.franqueado_id = p.id
WHERE k.nome = 'Funil Step One'
  AND c.status = 'ativo'
ORDER BY f.ordem, c.created_at DESC;

-- PASSO 3: Atualizar cards para o seu usuário
-- ATENÇÃO: Substitua 'SEU_USER_ID_AQUI' pelo ID que você copiou do PASSO 1
-- Descomente a linha abaixo (remova os --) e substitua o ID:

-- UPDATE public.kanban_cards SET franqueado_id = 'SEU_USER_ID_AQUI'::uuid WHERE kanban_id IN (SELECT id FROM public.kanbans WHERE nome = 'Funil Step One') AND status = 'ativo';

-- ALTERNATIVA: Tornar o primeiro usuário admin (vê todos os cards)
-- Descomente a linha abaixo se preferir virar admin:

-- UPDATE public.profiles SET role = 'admin' WHERE id = (SELECT id FROM public.profiles ORDER BY created_at LIMIT 1);
