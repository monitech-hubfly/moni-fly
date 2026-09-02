-- Migration temporária: Card de exemplo no Funil Step One
-- Cria um card de exemplo para visualização das alterações da Sprint A

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_user_id UUID;
BEGIN
  -- Busca o Kanban "Funil Step One"
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
  LIMIT 1;

  -- Se não encontrou, não faz nada
  IF v_kanban_id IS NULL THEN
    RAISE NOTICE 'Kanban Funil Step One não encontrado';
    RETURN;
  END IF;

  -- Busca a primeira fase (Dados da Cidade)
  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
  ORDER BY ordem
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE 'Nenhuma fase encontrada para o Kanban';
    RETURN;
  END IF;

  -- Busca o primeiro usuário admin ou consultor para ser o dono do card
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE role IN ('admin', 'consultor')
  LIMIT 1;

  -- Se não encontrou admin, pega qualquer usuário
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM auth.users
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Nenhum usuário encontrado';
    RETURN;
  END IF;

  -- Insere 3 cards de exemplo em fases diferentes
  -- Card 1: Dados da Cidade (criado há 8 dias - ATRASADO)
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  )
  SELECT
    v_kanban_id,
    v_fase_id,
    v_user_id,
    'Mapeamento da Zona Sul de São Paulo',
    'ativo',
    NOW() - INTERVAL '8 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE titulo = 'Mapeamento da Zona Sul de São Paulo'
  );

  -- Card 2: Lista de Condomínios (criado há 6 dias - ATENÇÃO)
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  )
  SELECT
    v_kanban_id,
    (SELECT id FROM public.kanban_fases WHERE kanban_id = v_kanban_id ORDER BY ordem LIMIT 1 OFFSET 1),
    v_user_id,
    'Levantamento de condomínios em Alphaville',
    'ativo',
    NOW() - INTERVAL '6 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE titulo = 'Levantamento de condomínios em Alphaville'
  );

  -- Card 3: Dados dos Condomínios (criado há 3 dias - OK)
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  )
  SELECT
    v_kanban_id,
    (SELECT id FROM public.kanban_fases WHERE kanban_id = v_kanban_id ORDER BY ordem LIMIT 1 OFFSET 2),
    v_user_id,
    'Análise de viabilidade - Residencial Alto Padrão',
    'ativo',
    NOW() - INTERVAL '3 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE titulo = 'Análise de viabilidade - Residencial Alto Padrão'
  );

  RAISE NOTICE 'Cards de exemplo criados com sucesso!';
END;
$$;
