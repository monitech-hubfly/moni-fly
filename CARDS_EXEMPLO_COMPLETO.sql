-- ========================================
-- CARDS DE EXEMPLO - FUNIL STEP ONE
-- Script completo com todos os estados de SLA em dias úteis
-- ========================================

-- 🧹 LIMPEZA: Remove cards exemplo anteriores
DELETE FROM public.kanban_cards 
WHERE titulo LIKE 'Exemplo%' 
  OR titulo LIKE 'Card Teste%'
  OR titulo LIKE 'João Silva%'
  OR titulo LIKE 'Maria Santos%'
  OR titulo LIKE 'Pedro Costa%'
  OR titulo LIKE 'Ana Oliveira%';

-- 📊 Buscar IDs necessários
DO $$
DECLARE
  v_kanban_id UUID;
  v_user_id UUID;
  v_fase_1_id UUID;  -- Dados da Cidade
  v_fase_2_id UUID;  -- Lista de Condomínios
  v_fase_3_id UUID;  -- Dados dos Condomínios
  v_fase_4_id UUID;  -- Lotes disponíveis
  v_fase_5_id UUID;  -- Mapa de Competidores
  v_fase_hoje DATE := CURRENT_DATE;
  v_data_atrasado_grave DATE;
  v_data_atrasado_leve DATE;
  v_data_atencao DATE;
  v_data_ok DATE;
BEGIN
  -- Busca o Kanban "Funil Step One"
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE EXCEPTION 'Kanban "Funil Step One" não encontrado. Execute a migração 091_step_one_kanban.sql primeiro.';
  END IF;

  -- Busca o usuário atual (primeiro admin ou qualquer usuário)
  SELECT id INTO v_user_id
  FROM auth.users
  ORDER BY created_at
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário encontrado. Faça login primeiro.';
  END IF;

  -- Busca as fases em ordem
  SELECT id INTO v_fase_1_id FROM public.kanban_fases 
  WHERE kanban_id = v_kanban_id AND ordem = 1;
  
  SELECT id INTO v_fase_2_id FROM public.kanban_fases 
  WHERE kanban_id = v_kanban_id AND ordem = 2;
  
  SELECT id INTO v_fase_3_id FROM public.kanban_fases 
  WHERE kanban_id = v_kanban_id AND ordem = 3;
  
  SELECT id INTO v_fase_4_id FROM public.kanban_fases 
  WHERE kanban_id = v_kanban_id AND ordem = 4;
  
  SELECT id INTO v_fase_5_id FROM public.kanban_fases 
  WHERE kanban_id = v_kanban_id AND ordem = 5;

  -- Calcula datas considerando dias úteis (SLA padrão: 5 dias úteis)
  -- Usa a função que criamos para adicionar dias úteis
  
  -- Atrasado grave: 10 dias úteis atrás (vermelho, "Atrasado 5 d.u.")
  v_data_atrasado_grave := v_fase_hoje - INTERVAL '14 days';
  
  -- Atrasado leve: 7 dias úteis atrás (vermelho, "Atrasado 2 d.u.")
  v_data_atrasado_leve := v_fase_hoje - INTERVAL '9 days';
  
  -- Atenção: 4 dias úteis atrás (dourado, "Vence em 1 d.u.")
  v_data_atencao := v_fase_hoje - INTERVAL '6 days';
  
  -- OK: 2 dias úteis atrás (sem tag, "3 d.u. restantes")
  v_data_ok := v_fase_hoje - INTERVAL '3 days';

  RAISE NOTICE '=======================================';
  RAISE NOTICE 'Criando cards de exemplo...';
  RAISE NOTICE 'Kanban ID: %', v_kanban_id;
  RAISE NOTICE 'Usuário ID: %', v_user_id;
  RAISE NOTICE '=======================================';

  -- 🔴 CARD 1: Atrasado grave (10 d.u. atrás) - Fase 1
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  ) VALUES (
    v_kanban_id,
    v_fase_1_id,
    v_user_id,
    'João Silva - Dados da Cidade',
    'ativo',
    v_data_atrasado_grave
  );
  RAISE NOTICE '✓ Card 1 criado: Atrasado grave (10 d.u.)';

  -- 🔴 CARD 2: Atrasado leve (7 d.u. atrás) - Fase 2
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  ) VALUES (
    v_kanban_id,
    v_fase_2_id,
    v_user_id,
    'Maria Santos - Lista de Condomínios',
    'ativo',
    v_data_atrasado_leve
  );
  RAISE NOTICE '✓ Card 2 criado: Atrasado leve (7 d.u.)';

  -- 🟡 CARD 3: Atenção (4 d.u. atrás, vence em 1 d.u.) - Fase 3
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  ) VALUES (
    v_kanban_id,
    v_fase_3_id,
    v_user_id,
    'Pedro Costa - Dados dos Condomínios',
    'ativo',
    v_data_atencao
  );
  RAISE NOTICE '✓ Card 3 criado: Atenção (vence em 1 d.u.)';

  -- ✅ CARD 4: OK (2 d.u. atrás, 3 d.u. restantes) - Fase 4
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  ) VALUES (
    v_kanban_id,
    v_fase_4_id,
    v_user_id,
    'Ana Oliveira - Lotes disponíveis',
    'ativo',
    v_data_ok
  );
  RAISE NOTICE '✓ Card 4 criado: OK (3 d.u. restantes)';

  -- ✅ CARD 5: Recém criado (hoje) - Fase 1
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  ) VALUES (
    v_kanban_id,
    v_fase_1_id,
    v_user_id,
    'Carlos Mendes - Dados da Cidade',
    'ativo',
    v_fase_hoje
  );
  RAISE NOTICE '✓ Card 5 criado: Recém criado (hoje)';

  -- 🔴 CARD 6: Atrasado (6 d.u. atrás) - Fase 5
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  ) VALUES (
    v_kanban_id,
    v_fase_5_id,
    v_user_id,
    'Fernanda Lima - Mapa de Competidores',
    'ativo',
    v_fase_hoje - INTERVAL '8 days'
  );
  RAISE NOTICE '✓ Card 6 criado: Atrasado (6 d.u.)';

  -- 🟡 CARD 7: Vence hoje - Fase 2
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  ) VALUES (
    v_kanban_id,
    v_fase_2_id,
    v_user_id,
    'Roberto Alves - Lista de Condomínios',
    'ativo',
    v_fase_hoje - INTERVAL '7 days'  -- 5 dias úteis atrás
  );
  RAISE NOTICE '✓ Card 7 criado: Vence hoje';

  -- ✅ CARD 8: Bem dentro do prazo - Fase 3
  INSERT INTO public.kanban_cards (
    kanban_id,
    fase_id,
    franqueado_id,
    titulo,
    status,
    created_at
  ) VALUES (
    v_kanban_id,
    v_fase_3_id,
    v_user_id,
    'Juliana Ferreira - Dados dos Condomínios',
    'ativo',
    v_fase_hoje - INTERVAL '1 day'
  );
  RAISE NOTICE '✓ Card 8 criado: Bem dentro do prazo';

  RAISE NOTICE '=======================================';
  RAISE NOTICE '✅ 8 cards de exemplo criados com sucesso!';
  RAISE NOTICE '=======================================';
END $$;

-- 📊 VERIFICAÇÃO: Lista todos os cards criados com seus status de SLA
SELECT 
  kc.id,
  kc.titulo,
  kf.nome as fase,
  kc.created_at::date as criado_em,
  CURRENT_DATE - kc.created_at::date as dias_corridos,
  public.calcular_dias_uteis(kc.created_at::date, CURRENT_DATE) as dias_uteis_decorridos,
  kf.sla_dias as sla_dias_uteis,
  CASE 
    WHEN public.calcular_dias_uteis(kc.created_at::date, CURRENT_DATE) > COALESCE(kf.sla_dias, 5) 
    THEN '🔴 ATRASADO'
    WHEN public.calcular_dias_uteis(kc.created_at::date, CURRENT_DATE) >= COALESCE(kf.sla_dias, 5) - 1 
    THEN '🟡 ATENÇÃO'
    ELSE '✅ OK'
  END as status_sla
FROM public.kanban_cards kc
JOIN public.kanban_fases kf ON kc.fase_id = kf.id
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
  AND kc.status = 'ativo'
ORDER BY kc.created_at DESC;

-- 📝 RESUMO POR FASE
SELECT 
  kf.ordem,
  kf.nome as fase,
  COUNT(*) as total_cards,
  COUNT(*) FILTER (
    WHERE public.calcular_dias_uteis(kc.created_at::date, CURRENT_DATE) > COALESCE(kf.sla_dias, 5)
  ) as atrasados,
  COUNT(*) FILTER (
    WHERE public.calcular_dias_uteis(kc.created_at::date, CURRENT_DATE) >= COALESCE(kf.sla_dias, 5) - 1
      AND public.calcular_dias_uteis(kc.created_at::date, CURRENT_DATE) <= COALESCE(kf.sla_dias, 5)
  ) as atencao,
  COUNT(*) FILTER (
    WHERE public.calcular_dias_uteis(kc.created_at::date, CURRENT_DATE) < COALESCE(kf.sla_dias, 5) - 1
  ) as ok
FROM public.kanban_cards kc
JOIN public.kanban_fases kf ON kc.fase_id = kf.id
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
  AND kc.status = 'ativo'
GROUP BY kf.ordem, kf.nome
ORDER BY kf.ordem;

-- ========================================
-- 🎉 SCRIPT CONCLUÍDO!
-- 
-- Foram criados 8 cards de exemplo distribuídos em:
-- - 3 cards ATRASADOS (vermelho)
-- - 2 cards em ATENÇÃO (dourado)
-- - 3 cards OK (sem tag ou com dias restantes)
--
-- Eles testam todos os cenários de SLA em dias úteis:
-- - Atrasado grave (>5 d.u. de atraso)
-- - Atrasado leve (1-3 d.u. de atraso)
-- - Vence hoje (D-day)
-- - Vence amanhã (D-1)
-- - Dentro do prazo (>2 d.u. restantes)
-- - Recém criado (5 d.u. inteiros disponíveis)
-- ========================================
