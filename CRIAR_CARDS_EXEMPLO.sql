-- ========================================
-- SCRIPT PARA CRIAR CARDS DE EXEMPLO
-- Execute no Supabase Dashboard > SQL Editor
-- ========================================

-- Este script cria 3 cards de exemplo no Funil Step One
-- para visualizar as mudanças da Sprint A:
-- 1. Card ATRASADO (8 dias atrás)
-- 2. Card em ATENÇÃO (6 dias atrás)  
-- 3. Card OK (3 dias atrás)

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_1_id UUID;
  v_fase_2_id UUID;
  v_fase_3_id UUID;
  v_user_id UUID;
BEGIN
  -- Busca o Kanban "Funil Step One"
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE EXCEPTION 'Kanban "Funil Step One" não encontrado. Execute primeiro a migration 091_step_one_kanban.sql';
  END IF;

  -- Busca as 3 primeiras fases
  SELECT id INTO v_fase_1_id FROM public.kanban_fases WHERE kanban_id = v_kanban_id ORDER BY ordem LIMIT 1;
  SELECT id INTO v_fase_2_id FROM public.kanban_fases WHERE kanban_id = v_kanban_id ORDER BY ordem LIMIT 1 OFFSET 1;
  SELECT id INTO v_fase_3_id FROM public.kanban_fases WHERE kanban_id = v_kanban_id ORDER BY ordem LIMIT 1 OFFSET 2;

  -- Busca o usuário atual (o que está executando o script)
  SELECT auth.uid() INTO v_user_id;
  
  -- Se não houver usuário logado, busca qualquer admin
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM public.profiles
    WHERE role IN ('admin', 'consultor')
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário encontrado. Faça login ou crie um usuário primeiro.';
  END IF;

  -- CARD 1: Dados da Cidade (criado há 8 dias - ATRASADO, pois SLA é 7 dias)
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  )
  VALUES (
    v_kanban_id,
    v_fase_1_id,
    v_user_id,
    'Mapeamento da Zona Sul de São Paulo',
    'ativo',
    NOW() - INTERVAL '8 days'
  )
  ON CONFLICT DO NOTHING;

  -- CARD 2: Lista de Condomínios (criado há 6 dias - ATENÇÃO, vence em 1 dia)
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  )
  VALUES (
    v_kanban_id,
    v_fase_2_id,
    v_user_id,
    'Levantamento de condomínios em Alphaville',
    'ativo',
    NOW() - INTERVAL '6 days'
  )
  ON CONFLICT DO NOTHING;

  -- CARD 3: Dados dos Condomínios (criado há 3 dias - OK, ainda tem 7 dias)
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  )
  VALUES (
    v_kanban_id,
    v_fase_3_id,
    v_user_id,
    'Análise de viabilidade - Residencial Alto Padrão',
    'ativo',
    NOW() - INTERVAL '3 days'
  )
  ON CONFLICT DO NOTHING;

  -- CARD 4: Lotes disponíveis (criado há 1 dia - OK, prazo tranquilo)
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  )
  VALUES (
    v_kanban_id,
    (SELECT id FROM public.kanban_fases WHERE kanban_id = v_kanban_id ORDER BY ordem LIMIT 1 OFFSET 3),
    v_user_id,
    'Levantamento de terrenos disponíveis - Brooklin',
    'ativo',
    NOW() - INTERVAL '1 day'
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ Cards de exemplo criados com sucesso!';
  RAISE NOTICE 'Acesse http://localhost:3000/funil-stepone para visualizar';
END;
$$;

-- Verificar os cards criados
SELECT 
  c.id,
  c.titulo,
  f.nome as fase,
  c.created_at,
  c.status
FROM public.kanban_cards c
JOIN public.kanban_fases f ON c.fase_id = f.id
JOIN public.kanbans k ON c.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
ORDER BY c.created_at DESC;
