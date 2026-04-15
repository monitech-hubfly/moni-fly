-- ========================================
-- CARDS DE EXEMPLO - VERSÃO SIMPLES
-- Execute este script no Supabase Dashboard > SQL Editor
-- ========================================

-- IMPORTANTE: Substitua os valores abaixo antes de executar
-- Para encontrar esses IDs, execute primeiro as queries de consulta no final

-- ⚙️ CONFIGURAÇÃO: Substitua com seus IDs reais
-- (Execute as queries no final para encontrar esses valores)

DO $$
DECLARE
  -- 🔧 AJUSTE ESTES VALORES:
  v_kanban_id UUID := '00000000-0000-0000-0000-000000000000';  -- ID do Kanban "Funil Step One"
  v_user_id UUID := '00000000-0000-0000-0000-000000000000';    -- Seu ID de usuário
  v_hoje DATE := CURRENT_DATE;
BEGIN
  -- Se os IDs não foram configurados, buscar automaticamente
  IF v_kanban_id = '00000000-0000-0000-0000-000000000000' THEN
    SELECT id INTO v_kanban_id FROM public.kanbans WHERE nome = 'Funil Step One' LIMIT 1;
    SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
    RAISE NOTICE 'IDs encontrados automaticamente:';
    RAISE NOTICE 'Kanban ID: %', v_kanban_id;
    RAISE NOTICE 'Usuário ID: %', v_user_id;
  END IF;

  -- 🧹 Limpa cards exemplo anteriores
  DELETE FROM public.kanban_cards 
  WHERE titulo LIKE 'João Silva%' 
     OR titulo LIKE 'Maria Santos%'
     OR titulo LIKE 'Pedro Costa%'
     OR titulo LIKE 'Ana Oliveira%'
     OR titulo LIKE 'Carlos Mendes%'
     OR titulo LIKE 'Fernanda Lima%'
     OR titulo LIKE 'Roberto Alves%'
     OR titulo LIKE 'Juliana Ferreira%';

  RAISE NOTICE 'Cards anteriores removidos.';

  -- 📝 Cria novos cards de exemplo
  -- Card 1: Atrasado grave (14 dias atrás = ~10 d.u.)
  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status, created_at)
  SELECT 
    v_kanban_id,
    id as fase_id,
    v_user_id,
    'João Silva - Dados da Cidade',
    'ativo',
    v_hoje - INTERVAL '14 days'
  FROM public.kanban_fases 
  WHERE kanban_id = v_kanban_id AND ordem = 1
  LIMIT 1;

  -- Card 2: Atrasado leve (9 dias atrás = ~7 d.u.)
  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status, created_at)
  SELECT 
    v_kanban_id,
    id as fase_id,
    v_user_id,
    'Maria Santos - Lista de Condomínios',
    'ativo',
    v_hoje - INTERVAL '9 days'
  FROM public.kanban_fases 
  WHERE kanban_id = v_kanban_id AND ordem = 2
  LIMIT 1;

  -- Card 3: Atenção (6 dias atrás = ~4 d.u., vence em 1 d.u.)
  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status, created_at)
  SELECT 
    v_kanban_id,
    id as fase_id,
    v_user_id,
    'Pedro Costa - Dados dos Condomínios',
    'ativo',
    v_hoje - INTERVAL '6 days'
  FROM public.kanban_fases 
  WHERE kanban_id = v_kanban_id AND ordem = 3
  LIMIT 1;

  -- Card 4: OK (3 dias atrás = ~2 d.u., 3 d.u. restantes)
  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status, created_at)
  SELECT 
    v_kanban_id,
    id as fase_id,
    v_user_id,
    'Ana Oliveira - Lotes disponíveis',
    'ativo',
    v_hoje - INTERVAL '3 days'
  FROM public.kanban_fases 
  WHERE kanban_id = v_kanban_id AND ordem = 4
  LIMIT 1;

  -- Card 5: Recém criado (hoje)
  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status, created_at)
  SELECT 
    v_kanban_id,
    id as fase_id,
    v_user_id,
    'Carlos Mendes - Dados da Cidade',
    'ativo',
    v_hoje
  FROM public.kanban_fases 
  WHERE kanban_id = v_kanban_id AND ordem = 1
  LIMIT 1;

  -- Card 6: Atrasado (8 dias atrás)
  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status, created_at)
  SELECT 
    v_kanban_id,
    id as fase_id,
    v_user_id,
    'Fernanda Lima - Mapa de Competidores',
    'ativo',
    v_hoje - INTERVAL '8 days'
  FROM public.kanban_fases 
  WHERE kanban_id = v_kanban_id AND ordem = 5
  LIMIT 1;

  -- Card 7: Vence hoje (7 dias atrás = 5 d.u.)
  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status, created_at)
  SELECT 
    v_kanban_id,
    id as fase_id,
    v_user_id,
    'Roberto Alves - Lista de Condomínios',
    'ativo',
    v_hoje - INTERVAL '7 days'
  FROM public.kanban_fases 
  WHERE kanban_id = v_kanban_id AND ordem = 2
  LIMIT 1;

  -- Card 8: Bem dentro do prazo (1 dia atrás)
  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status, created_at)
  SELECT 
    v_kanban_id,
    id as fase_id,
    v_user_id,
    'Juliana Ferreira - Dados dos Condomínios',
    'ativo',
    v_hoje - INTERVAL '1 day'
  FROM public.kanban_fases 
  WHERE kanban_id = v_kanban_id AND ordem = 3
  LIMIT 1;

  RAISE NOTICE '✅ 8 cards de exemplo criados com sucesso!';
END $$;

-- ========================================
-- 🔍 QUERIES DE CONSULTA (execute antes se necessário)
-- ========================================

-- 1️⃣ Encontrar o ID do Kanban "Funil Step One"
SELECT 
  id as kanban_id,
  nome,
  created_at
FROM public.kanbans 
WHERE nome = 'Funil Step One';

-- 2️⃣ Encontrar seu ID de usuário
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
ORDER BY created_at
LIMIT 5;

-- 3️⃣ Ver todas as fases do Funil Step One
SELECT 
  kf.id as fase_id,
  kf.ordem,
  kf.nome,
  kf.sla_dias
FROM public.kanban_fases kf
JOIN public.kanbans k ON kf.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
ORDER BY kf.ordem;

-- ========================================
-- 📊 VERIFICAÇÃO: Ver cards criados com status SLA
-- ========================================
SELECT 
  kc.titulo,
  kf.nome as fase,
  kc.created_at::date as criado_em,
  CURRENT_DATE - kc.created_at::date as dias_corridos,
  CASE 
    WHEN CURRENT_DATE - kc.created_at::date > 7 THEN '🔴 ATRASADO'
    WHEN CURRENT_DATE - kc.created_at::date >= 5 THEN '🟡 ATENÇÃO'
    ELSE '✅ OK'
  END as status_estimado
FROM public.kanban_cards kc
JOIN public.kanban_fases kf ON kc.fase_id = kf.id
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
  AND kc.status = 'ativo'
ORDER BY kc.created_at DESC;

-- ========================================
-- 🎉 RESUMO
--
-- Este script cria 8 cards de exemplo com diferentes estados:
-- - 3 ATRASADOS (vermelho): > 7 dias corridos
-- - 2 ATENÇÃO (dourado): 5-7 dias corridos
-- - 3 OK (sem tag): < 5 dias corridos
--
-- Os cards estão distribuídos nas 5 primeiras fases do funil.
-- ========================================
