-- ========================================
-- ATUALIZAR CARDS EXISTENTES COM NOVAS DATAS
-- Use este script se você já tem cards e quer apenas
-- atualizar as datas para refletir os estados de SLA
-- ========================================

-- 📊 Primeiro, veja seus cards atuais:
SELECT 
  kc.id,
  kc.titulo,
  kf.nome as fase,
  kc.created_at::date as criado_em,
  CURRENT_DATE - kc.created_at::date as dias_corridos
FROM public.kanban_cards kc
JOIN public.kanban_fases kf ON kc.fase_id = kf.id
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
  AND kc.status = 'ativo'
ORDER BY kc.created_at DESC;

-- ========================================
-- 🔄 OPÇÃO 1: Atualizar datas automaticamente
-- Atualiza todos os cards ativos para distribuir
-- em diferentes estados de SLA
-- ========================================

DO $$
DECLARE
  v_hoje DATE := CURRENT_DATE;
  v_cards UUID[];
  v_datas DATE[] := ARRAY[
    v_hoje - INTERVAL '14 days',  -- Atrasado grave
    v_hoje - INTERVAL '9 days',   -- Atrasado leve
    v_hoje - INTERVAL '8 days',   -- Atrasado
    v_hoje - INTERVAL '7 days',   -- Vence hoje
    v_hoje - INTERVAL '6 days',   -- Atenção
    v_hoje - INTERVAL '3 days',   -- OK
    v_hoje - INTERVAL '1 day',    -- Bem dentro
    v_hoje                         -- Recém criado
  ];
  v_idx INT := 1;
  v_card_id UUID;
BEGIN
  -- Busca IDs dos cards ativos
  SELECT ARRAY_AGG(id ORDER BY created_at DESC) INTO v_cards
  FROM public.kanban_cards kc
  JOIN public.kanbans k ON kc.kanban_id = k.id
  WHERE k.nome = 'Funil Step One'
    AND kc.status = 'ativo';

  -- Atualiza cada card com uma data diferente
  FOREACH v_card_id IN ARRAY v_cards
  LOOP
    IF v_idx <= ARRAY_LENGTH(v_datas, 1) THEN
      UPDATE public.kanban_cards
      SET created_at = v_datas[v_idx]
      WHERE id = v_card_id;
      
      RAISE NOTICE 'Card % atualizado para %', v_card_id, v_datas[v_idx];
      v_idx := v_idx + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ % cards atualizados com novas datas', v_idx - 1;
END $$;

-- ========================================
-- 🔄 OPÇÃO 2: Atualizar cards específicos manualmente
-- Substitua os IDs pelos seus cards reais
-- ========================================

-- Exemplo de atualização manual:
/*
-- Atrasado grave (14 dias atrás)
UPDATE public.kanban_cards 
SET created_at = CURRENT_DATE - INTERVAL '14 days'
WHERE id = 'SEU_CARD_ID_AQUI';

-- Atrasado leve (9 dias atrás)
UPDATE public.kanban_cards 
SET created_at = CURRENT_DATE - INTERVAL '9 days'
WHERE id = 'SEU_CARD_ID_AQUI';

-- Atenção (6 dias atrás, vence em 1 d.u.)
UPDATE public.kanban_cards 
SET created_at = CURRENT_DATE - INTERVAL '6 days'
WHERE id = 'SEU_CARD_ID_AQUI';

-- OK (3 dias atrás)
UPDATE public.kanban_cards 
SET created_at = CURRENT_DATE - INTERVAL '3 days'
WHERE id = 'SEU_CARD_ID_AQUI';

-- Recém criado (hoje)
UPDATE public.kanban_cards 
SET created_at = CURRENT_DATE
WHERE id = 'SEU_CARD_ID_AQUI';
*/

-- ========================================
-- 🔄 OPÇÃO 3: Atualizar títulos para o novo formato
-- Atualiza títulos para o formato "Nome - Fase"
-- ========================================

UPDATE public.kanban_cards kc
SET titulo = CONCAT(
  COALESCE(p.full_name, 'Franqueado'),
  ' - ',
  kf.nome
)
FROM public.kanban_fases kf
LEFT JOIN public.profiles p ON kc.franqueado_id = p.id
WHERE kc.fase_id = kf.id
  AND kc.titulo NOT LIKE '%-%'  -- Só atualiza se não tiver o formato correto
  AND kc.kanban_id IN (
    SELECT id FROM public.kanbans WHERE nome = 'Funil Step One'
  );

-- ========================================
-- 📊 VERIFICAÇÃO FINAL: Ver resultado
-- ========================================

SELECT 
  kc.titulo,
  kf.nome as fase,
  kc.created_at::date as criado_em,
  CURRENT_DATE - kc.created_at::date as dias_corridos,
  CASE 
    WHEN CURRENT_DATE - kc.created_at::date > 7 THEN '🔴 ATRASADO (' || (CURRENT_DATE - kc.created_at::date) || 'd)'
    WHEN CURRENT_DATE - kc.created_at::date >= 5 THEN '🟡 ATENÇÃO (' || (CURRENT_DATE - kc.created_at::date) || 'd)'
    ELSE '✅ OK (' || (CURRENT_DATE - kc.created_at::date) || 'd)'
  END as status_sla
FROM public.kanban_cards kc
JOIN public.kanban_fases kf ON kc.fase_id = kf.id
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
  AND kc.status = 'ativo'
ORDER BY kc.created_at DESC;

-- ========================================
-- 📈 CONTAGEM POR STATUS
-- ========================================

SELECT 
  CASE 
    WHEN CURRENT_DATE - kc.created_at::date > 7 THEN '🔴 ATRASADO'
    WHEN CURRENT_DATE - kc.created_at::date >= 5 THEN '🟡 ATENÇÃO'
    ELSE '✅ OK'
  END as status,
  COUNT(*) as quantidade
FROM public.kanban_cards kc
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
  AND kc.status = 'ativo'
GROUP BY 1
ORDER BY 1;

-- ========================================
-- 🎯 DICAS DE USO
-- ========================================

/*
QUANDO USAR CADA SCRIPT:

1. CARDS_EXEMPLO_COMPLETO.sql
   → Cria novos cards do zero
   → Usa função de dias úteis
   → Mais preciso para testar SLA real
   → Recomendado para produção

2. CARDS_EXEMPLO_SIMPLES.sql
   → Cria novos cards do zero
   → Usa dias corridos (mais simples)
   → Mais fácil de ajustar manualmente
   → Recomendado para desenvolvimento

3. ATUALIZAR_CARDS_EXEMPLO.sql (este arquivo)
   → Atualiza cards existentes
   → Não cria novos cards
   → Útil para ajustar testes
   → Recomendado quando já tem dados

DATAS SUGERIDAS PARA TESTES:
- 14 dias atrás: Atrasado grave (10 d.u.)
- 9 dias atrás: Atrasado leve (7 d.u.)
- 8 dias atrás: Atrasado moderado (6 d.u.)
- 7 dias atrás: Vence hoje (5 d.u.)
- 6 dias atrás: Atenção D-1 (4 d.u.)
- 3 dias atrás: OK (2 d.u.)
- 1 dia atrás: Bem dentro do prazo
- Hoje: Recém criado
*/
