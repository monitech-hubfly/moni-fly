-- ========================================
-- ATIVIDADES EXEMPLO - FUNIL STEP ONE
-- Cria atividades exemplo para cards existentes
-- ========================================

-- 🧹 LIMPEZA: Remove atividades exemplo anteriores
DELETE FROM public.kanban_atividades 
WHERE titulo LIKE 'Exemplo:%' OR titulo LIKE 'Levantar dados%' OR titulo LIKE 'Validar informações%';

-- ========================================
-- INSERIR ATIVIDADES EXEMPLO
-- ========================================

DO $$
DECLARE
  v_cards UUID[];
  v_card_id UUID;
  v_user_id UUID;
  v_kanban_id UUID;
  v_idx INT := 0;
BEGIN
  -- Busca o Kanban "Funil Step One"
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE EXCEPTION 'Kanban "Funil Step One" não encontrado';
  END IF;

  -- Busca um usuário para ser responsável
  SELECT id INTO v_user_id
  FROM auth.users
  ORDER BY created_at
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário encontrado';
  END IF;

  -- Busca todos os cards ativos do Funil Step One
  SELECT ARRAY_AGG(id) INTO v_cards
  FROM public.kanban_cards kc
  WHERE kc.kanban_id = v_kanban_id
    AND kc.status = 'ativo';

  IF v_cards IS NULL OR ARRAY_LENGTH(v_cards, 1) = 0 THEN
    RAISE NOTICE 'Nenhum card ativo encontrado. Execute primeiro CARDS_EXEMPLO_SIMPLES.sql ou CARDS_EXEMPLO_COMPLETO.sql';
    RETURN;
  END IF;

  RAISE NOTICE '=======================================';
  RAISE NOTICE 'Criando atividades exemplo...';
  RAISE NOTICE 'Cards encontrados: %', ARRAY_LENGTH(v_cards, 1);
  RAISE NOTICE '=======================================';

  -- Percorre cada card e cria 3-5 atividades exemplo
  FOREACH v_card_id IN ARRAY v_cards
  LOOP
    v_idx := v_idx + 1;
    
    -- Atividade 1: Concluída
    INSERT INTO public.kanban_atividades (
      card_id,
      titulo,
      descricao,
      status,
      prioridade,
      responsavel_id,
      criado_por,
      time,
      ordem,
      created_at,
      concluida_em
    ) VALUES (
      v_card_id,
      'Levantar dados cadastrais do município',
      'Coletar informações básicas: população, PIB, taxa de crescimento',
      'concluida',
      'alta',
      v_user_id,
      v_user_id,
      'operacoes',
      1,
      NOW() - INTERVAL '5 days',
      NOW() - INTERVAL '4 days'
    );

    -- Atividade 2: Em andamento
    INSERT INTO public.kanban_atividades (
      card_id,
      titulo,
      descricao,
      status,
      prioridade,
      responsavel_id,
      criado_por,
      time,
      ordem,
      created_at
    ) VALUES (
      v_card_id,
      'Validar informações com a prefeitura',
      'Confirmar dados junto aos órgãos oficiais',
      'em_andamento',
      'alta',
      v_user_id,
      v_user_id,
      'juridico',
      2,
      NOW() - INTERVAL '3 days'
    );

    -- Atividade 3: Pendente com prazo próximo
    INSERT INTO public.kanban_atividades (
      card_id,
      titulo,
      descricao,
      status,
      prioridade,
      responsavel_id,
      criado_por,
      time,
      data_vencimento,
      ordem,
      created_at
    ) VALUES (
      v_card_id,
      'Agendar reunião com corretores locais',
      'Marcar encontro para entender dinâmica do mercado imobiliário',
      'pendente',
      'normal',
      v_user_id,
      v_user_id,
      'comercial',
      CURRENT_DATE + INTERVAL '2 days',
      3,
      NOW() - INTERVAL '2 days'
    );

    -- Atividade 4: Pendente urgente
    INSERT INTO public.kanban_atividades (
      card_id,
      titulo,
      descricao,
      status,
      prioridade,
      responsavel_id,
      criado_por,
      time,
      data_vencimento,
      ordem,
      created_at
    ) VALUES (
      v_card_id,
      'Solicitar certidões e documentos necessários',
      'Reunir toda documentação legal para análise de viabilidade',
      'pendente',
      'urgente',
      v_user_id,
      v_user_id,
      'juridico',
      CURRENT_DATE + INTERVAL '1 day',
      4,
      NOW() - INTERVAL '1 day'
    );

    -- Atividade 5: Pendente baixa prioridade (apenas para alguns cards)
    IF v_idx % 2 = 0 THEN
      INSERT INTO public.kanban_atividades (
        card_id,
        titulo,
        descricao,
        status,
        prioridade,
        responsavel_id,
        criado_por,
        time,
        data_vencimento,
        ordem,
        created_at
      ) VALUES (
        v_card_id,
        'Preparar relatório fotográfico da região',
        'Fazer registros visuais dos principais pontos de interesse',
        'pendente',
        'baixa',
        v_user_id,
        v_user_id,
        'operacoes',
        CURRENT_DATE + INTERVAL '7 days',
        5,
        NOW()
      );
    END IF;

    RAISE NOTICE '✓ Card %: 4-5 atividades criadas', v_idx;
  END LOOP;

  RAISE NOTICE '=======================================';
  RAISE NOTICE '✅ Atividades exemplo criadas com sucesso!';
  RAISE NOTICE '=======================================';
END $$;

-- ========================================
-- VERIFICAÇÃO: Ver atividades criadas
-- ========================================

SELECT 
  kc.titulo as card,
  ka.titulo as atividade,
  ka.status,
  ka.prioridade,
  ka.data_vencimento,
  CASE 
    WHEN ka.status = 'concluida' THEN '✅'
    WHEN ka.status = 'em_andamento' THEN '🔄'
    WHEN ka.prioridade = 'urgente' THEN '🔴'
    WHEN ka.prioridade = 'alta' THEN '🟡'
    ELSE '⚪'
  END as icon
FROM public.kanban_atividades ka
JOIN public.kanban_cards kc ON ka.card_id = kc.id
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
ORDER BY kc.titulo, ka.ordem;

-- ========================================
-- RESUMO: Atividades por status
-- ========================================

SELECT 
  ka.status,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) || '%' as percentual
FROM public.kanban_atividades ka
JOIN public.kanban_cards kc ON ka.card_id = kc.id
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
GROUP BY ka.status
ORDER BY 
  CASE ka.status
    WHEN 'urgente' THEN 1
    WHEN 'em_andamento' THEN 2
    WHEN 'pendente' THEN 3
    WHEN 'concluida' THEN 4
    WHEN 'cancelada' THEN 5
  END;

-- ========================================
-- CONTAGEM: Total por card
-- ========================================

SELECT 
  kc.titulo as card,
  COUNT(*) as total_atividades,
  COUNT(*) FILTER (WHERE ka.status = 'concluida') as concluidas,
  COUNT(*) FILTER (WHERE ka.status = 'em_andamento') as em_andamento,
  COUNT(*) FILTER (WHERE ka.status = 'pendente') as pendentes
FROM public.kanban_cards kc
LEFT JOIN public.kanban_atividades ka ON kc.id = ka.card_id
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One' AND kc.status = 'ativo'
GROUP BY kc.id, kc.titulo
ORDER BY kc.created_at DESC;

-- ========================================
-- 🎉 SCRIPT CONCLUÍDO!
--
-- Foram criadas 4-5 atividades para cada card ativo:
-- - 1 atividade CONCLUÍDA
-- - 1 atividade EM ANDAMENTO
-- - 2-3 atividades PENDENTES (variando prioridades)
--
-- Estados criados:
-- ✅ Concluída (verde)
-- 🔄 Em andamento (azul)
-- 🔴 Urgente (vermelho)
-- 🟡 Alta prioridade (amarelo/dourado)
-- ⚪ Normal/Baixa (neutro)
-- ========================================
