-- ========================================
-- CARDS DE EXEMPLO ATUALIZADOS - FUNIL STEP ONE
-- Formato: FK0001 - Nome do Franqueado - Área de Atuação
-- Com SLA em dias úteis e distribuídos pelas 7 fases
-- Data: 15/04/2026
-- ========================================

-- 📊 Criar cards atualizados
DO $$
DECLARE
  v_kanban_id UUID;
  v_user_id UUID;
  v_fase_ids UUID[];
  v_hoje DATE := CURRENT_DATE;
  v_contador INT := 1;
BEGIN
  -- Busca o Kanban "Funil Step One"
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE EXCEPTION '❌ Kanban "Funil Step One" não encontrado. Execute 091_step_one_kanban.sql primeiro.';
  END IF;

  -- Busca usuário (primeiro disponível)
  SELECT id INTO v_user_id
  FROM auth.users
  ORDER BY created_at
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '❌ Nenhum usuário encontrado. Faça login primeiro.';
  END IF;

  -- Busca IDs das 7 fases em ordem
  SELECT ARRAY_AGG(id ORDER BY ordem) INTO v_fase_ids
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id;

  IF ARRAY_LENGTH(v_fase_ids, 1) < 7 THEN
    RAISE EXCEPTION '❌ Fases incompletas. Esperado 7, encontrado %', ARRAY_LENGTH(v_fase_ids, 1);
  END IF;

  -- Limpa cards anteriores do Funil Step One
  DELETE FROM public.kanban_cards WHERE kanban_id = v_kanban_id;
  
  RAISE NOTICE '=======================================';
  RAISE NOTICE '🧹 Cards anteriores removidos';
  RAISE NOTICE '✨ Criando cards atualizados...';
  RAISE NOTICE 'Kanban ID: %', v_kanban_id;
  RAISE NOTICE 'Usuário ID: %', v_user_id;
  RAISE NOTICE '=======================================';

  -- ============================================
  -- FASE 1: Dados da Cidade (4 cards)
  -- ============================================
  
  -- Card 1: Atrasado grave (10 dias úteis atrás)
  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[1],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - São Paulo Capital - Centro Expandido',
    'ativo',
    v_hoje - INTERVAL '14 days'  -- ~10 dias úteis
  );
  v_contador := v_contador + 1;
  RAISE NOTICE '✓ Card % criado: FK0001 - Atrasado grave', v_contador - 1;

  -- Card 2: Atenção (vence em 1 d.u.)
  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[1],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Campinas - Barão Geraldo',
    'ativo',
    v_hoje - INTERVAL '6 days'  -- ~4 dias úteis (vence em 1)
  );
  v_contador := v_contador + 1;
  RAISE NOTICE '✓ Card % criado: FK0002 - Atenção', v_contador - 1;

  -- Card 3: OK (3 d.u. restantes)
  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[1],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Ribeirão Preto - Zona Sul',
    'ativo',
    v_hoje - INTERVAL '3 days'  -- ~2 dias úteis
  );
  v_contador := v_contador + 1;
  RAISE NOTICE '✓ Card % criado: FK0003 - OK', v_contador - 1;

  -- Card 4: Recém criado (hoje)
  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[1],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Santos - Ponta da Praia',
    'ativo',
    v_hoje
  );
  v_contador := v_contador + 1;
  RAISE NOTICE '✓ Card % criado: FK0004 - Recém criado', v_contador - 1;

  -- ============================================
  -- FASE 2: Lista de Condomínios (3 cards)
  -- ============================================

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[2],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Belo Horizonte - Pampulha',
    'ativo',
    v_hoje - INTERVAL '9 days'  -- ~7 dias úteis (atrasado leve)
  );
  v_contador := v_contador + 1;

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[2],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Curitiba - Batel',
    'ativo',
    v_hoje - INTERVAL '5 days'  -- ~3 dias úteis (ok)
  );
  v_contador := v_contador + 1;

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[2],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Porto Alegre - Moinhos de Vento',
    'ativo',
    v_hoje - INTERVAL '1 day'  -- Muito recente
  );
  v_contador := v_contador + 1;

  RAISE NOTICE '✓ Fase 2: 3 cards criados (FK0005-FK0007)';

  -- ============================================
  -- FASE 3: Dados dos Condomínios (4 cards)
  -- ============================================

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[3],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Florianópolis - Jurerê Internacional',
    'ativo',
    v_hoje - INTERVAL '16 days'  -- ~12 dias úteis (muito atrasado)
  );
  v_contador := v_contador + 1;

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[3],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Brasília - Lago Sul',
    'ativo',
    v_hoje - INTERVAL '12 days'  -- ~9 dias úteis (atrasado)
  );
  v_contador := v_contador + 1;

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[3],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Goiânia - Setor Bueno',
    'ativo',
    v_hoje - INTERVAL '7 days'  -- ~5 dias úteis (ok)
  );
  v_contador := v_contador + 1;

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[3],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Salvador - Patamares',
    'ativo',
    v_hoje - INTERVAL '2 days'
  );
  v_contador := v_contador + 1;

  RAISE NOTICE '✓ Fase 3: 4 cards criados (FK0008-FK0011)';

  -- ============================================
  -- FASE 4: Lotes disponíveis (2 cards)
  -- ============================================

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[4],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Recife - Boa Viagem',
    'ativo',
    v_hoje - INTERVAL '6 days'  -- ~4 dias úteis (atenção)
  );
  v_contador := v_contador + 1;

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[4],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Fortaleza - Aldeota',
    'ativo',
    v_hoje - INTERVAL '4 days'  -- ~2 dias úteis (ok)
  );
  v_contador := v_contador + 1;

  RAISE NOTICE '✓ Fase 4: 2 cards criados (FK0012-FK0013)';

  -- ============================================
  -- FASE 5: Mapa de Competidores (2 cards)
  -- ============================================

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[5],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Manaus - Adrianópolis',
    'ativo',
    v_hoje - INTERVAL '11 days'  -- ~8 dias úteis (atrasado)
  );
  v_contador := v_contador + 1;

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[5],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Vitória - Praia do Canto',
    'ativo',
    v_hoje - INTERVAL '3 days'  -- ~2 dias úteis (ok)
  );
  v_contador := v_contador + 1;

  RAISE NOTICE '✓ Fase 5: 2 cards criados (FK0014-FK0015)';

  -- ============================================
  -- FASE 6: BCA + Batalha de Casas (2 cards)
  -- ============================================

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[6],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - São José dos Campos - Jardim Aquarius',
    'ativo',
    v_hoje - INTERVAL '5 days'  -- ~3 dias úteis (ok)
  );
  v_contador := v_contador + 1;

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[6],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Sorocaba - Além Ponte',
    'ativo',
    v_hoje - INTERVAL '1 day'
  );
  v_contador := v_contador + 1;

  RAISE NOTICE '✓ Fase 6: 2 cards criados (FK0016-FK0017)';

  -- ============================================
  -- FASE 7: Hipóteses (2 cards)
  -- ============================================

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[7],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Uberlândia - Santa Mônica',
    'ativo',
    v_hoje - INTERVAL '8 days'  -- ~6 dias úteis (ok no prazo)
  );
  v_contador := v_contador + 1;

  INSERT INTO public.kanban_cards (
    kanban_id, fase_id, franqueado_id, titulo, status, created_at
  ) VALUES (
    v_kanban_id,
    v_fase_ids[7],
    v_user_id,
    'FK' || LPAD(v_contador::TEXT, 4, '0') || ' - Londrina - Gleba Palhano',
    'ativo',
    v_hoje - INTERVAL '2 days'
  );
  v_contador := v_contador + 1;

  RAISE NOTICE '✓ Fase 7: 2 cards criados (FK0018-FK0019)';

  -- ============================================
  -- RESUMO
  -- ============================================

  RAISE NOTICE '=======================================';
  RAISE NOTICE '✅ CARDS CRIADOS COM SUCESSO!';
  RAISE NOTICE '=======================================';
  RAISE NOTICE 'Total: % cards', v_contador - 1;
  RAISE NOTICE 'Formato: FK0001 - Nome do Franqueado - Área';
  RAISE NOTICE '';
  RAISE NOTICE 'Distribuição por fase:';
  RAISE NOTICE '  Fase 1 (Dados da Cidade): 4 cards';
  RAISE NOTICE '  Fase 2 (Lista Condomínios): 3 cards';
  RAISE NOTICE '  Fase 3 (Dados Condomínios): 4 cards';
  RAISE NOTICE '  Fase 4 (Lotes disponíveis): 2 cards';
  RAISE NOTICE '  Fase 5 (Mapa Competidores): 2 cards';
  RAISE NOTICE '  Fase 6 (BCA + Batalha): 2 cards';
  RAISE NOTICE '  Fase 7 (Hipóteses): 2 cards';
  RAISE NOTICE '';
  RAISE NOTICE 'SLA Status:';
  RAISE NOTICE '  🔴 Atrasados: ~4 cards';
  RAISE NOTICE '  🟡 Atenção: ~2 cards';
  RAISE NOTICE '  ✅ No prazo: ~13 cards';
  RAISE NOTICE '=======================================';

END $$;

-- 🔍 VERIFICAÇÃO: Listar cards criados
SELECT 
  c.titulo,
  f.nome AS fase,
  f.ordem,
  c.status,
  c.created_at::date AS criado_em,
  (CURRENT_DATE - c.created_at::date) AS dias_desde_criacao
FROM public.kanban_cards c
JOIN public.kanban_fases f ON c.fase_id = f.id
JOIN public.kanbans k ON c.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
ORDER BY f.ordem, c.created_at;

-- ✅ PRONTO!
-- Execute este script no SQL Editor do Supabase
-- Depois recarregue a página: http://localhost:3000/funil-stepone
