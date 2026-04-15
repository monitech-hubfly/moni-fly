-- ========================================
-- SCRIPT DE VERIFICAÇÃO DE MIGRAÇÕES
-- Execute no Supabase SQL Editor
-- ========================================

DO $$
DECLARE
  resultado TEXT := E'=== VERIFICAÇÃO DE MIGRAÇÕES - Funil Step One ===\n\n';
BEGIN
  -- 1. Verificar tabelas
  resultado := resultado || E'📊 TABELAS:\n';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kanbans') THEN
    resultado := resultado || E'  ✅ kanbans\n';
  ELSE
    resultado := resultado || E'  ❌ kanbans (migration 091 NÃO RODOU)\n';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kanban_fases') THEN
    resultado := resultado || E'  ✅ kanban_fases\n';
  ELSE
    resultado := resultado || E'  ❌ kanban_fases (migration 091 NÃO RODOU)\n';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kanban_cards') THEN
    resultado := resultado || E'  ✅ kanban_cards\n';
  ELSE
    resultado := resultado || E'  ❌ kanban_cards (migration 091 NÃO RODOU)\n';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kanban_atividades') THEN
    resultado := resultado || E'  ✅ kanban_atividades\n';
  ELSE
    resultado := resultado || E'  ❌ kanban_atividades (migration 103 NÃO RODOU)\n';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feriados_nacionais') THEN
    resultado := resultado || E'  ✅ feriados_nacionais\n';
  ELSE
    resultado := resultado || E'  ❌ feriados_nacionais (migration 102 NÃO RODOU)\n';
  END IF;
  
  -- 2. Verificar colunas específicas
  resultado := resultado || E'\n📋 COLUNAS:\n';
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'kanban_atividades' 
      AND column_name = 'time'
  ) THEN
    resultado := resultado || E'  ✅ kanban_atividades.time\n';
  ELSE
    resultado := resultado || E'  ❌ kanban_atividades.time (migration 104 NÃO RODOU)\n';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'kanban_atividades' 
      AND column_name = 'prioridade'
  ) THEN
    resultado := resultado || E'  ✅ kanban_atividades.prioridade\n';
  ELSE
    resultado := resultado || E'  ❌ kanban_atividades.prioridade (migration 103 NÃO RODOU)\n';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'kanban_atividades' 
      AND column_name = 'ordem'
  ) THEN
    resultado := resultado || E'  ✅ kanban_atividades.ordem\n';
  ELSE
    resultado := resultado || E'  ❌ kanban_atividades.ordem (migration 103 NÃO RODOU)\n';
  END IF;
  
  -- 3. Verificar funções PL/pgSQL
  resultado := resultado || E'\n⚙️  FUNÇÕES:\n';
  
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'calcular_dias_uteis'
  ) THEN
    resultado := resultado || E'  ✅ calcular_dias_uteis(DATE, DATE)\n';
  ELSE
    resultado := resultado || E'  ❌ calcular_dias_uteis() (migration 102 NÃO RODOU)\n';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'adicionar_dias_uteis'
  ) THEN
    resultado := resultado || E'  ✅ adicionar_dias_uteis(DATE, INT)\n';
  ELSE
    resultado := resultado || E'  ❌ adicionar_dias_uteis() (migration 102 NÃO RODOU)\n';
  END IF;
  
  -- 4. Verificar dados (seed)
  resultado := resultado || E'\n📦 DADOS:\n';
  
  BEGIN
    DECLARE
      count_kanbans INT;
      count_fases INT;
      count_cards INT;
      count_atividades INT;
      count_feriados INT;
    BEGIN
      SELECT COUNT(*) INTO count_kanbans 
      FROM kanbans 
      WHERE nome = 'Funil Step One';
      
      SELECT COUNT(*) INTO count_fases 
      FROM kanban_fases kf
      JOIN kanbans k ON k.id = kf.kanban_id
      WHERE k.nome = 'Funil Step One';
      
      SELECT COUNT(*) INTO count_cards 
      FROM kanban_cards;
      
      SELECT COUNT(*) INTO count_atividades 
      FROM kanban_atividades;
      
      SELECT COUNT(*) INTO count_feriados 
      FROM feriados_nacionais;
      
      resultado := resultado || '  Kanbans "Funil Step One": ' || count_kanbans || E' (esperado: 1)\n';
      resultado := resultado || '  Fases do Funil: ' || count_fases || E' (esperado: 7)\n';
      resultado := resultado || '  Cards total: ' || count_cards || E'\n';
      resultado := resultado || '  Atividades total: ' || count_atividades || E'\n';
      resultado := resultado || '  Feriados: ' || count_feriados || E' (esperado: ~20-30)\n';
    EXCEPTION WHEN OTHERS THEN
      resultado := resultado || E'  ⚠️  Erro ao contar dados: ' || SQLERRM || E'\n';
      resultado := resultado || E'  (Tabelas podem não existir ainda)\n';
    END;
  END;
  
  -- 5. Verificar RLS
  resultado := resultado || E'\n🔒 ROW LEVEL SECURITY:\n';
  
  BEGIN
    DECLARE
      rls_kanban_cards BOOLEAN;
      rls_kanban_atividades BOOLEAN;
      count_policies_cards INT;
      count_policies_atividades INT;
    BEGIN
      SELECT relrowsecurity INTO rls_kanban_cards
      FROM pg_class
      WHERE relname = 'kanban_cards' AND relnamespace = 'public'::regnamespace;
      
      SELECT relrowsecurity INTO rls_kanban_atividades
      FROM pg_class
      WHERE relname = 'kanban_atividades' AND relnamespace = 'public'::regnamespace;
      
      SELECT COUNT(*) INTO count_policies_cards
      FROM pg_policies
      WHERE tablename = 'kanban_cards';
      
      SELECT COUNT(*) INTO count_policies_atividades
      FROM pg_policies
      WHERE tablename = 'kanban_atividades';
      
      IF rls_kanban_cards THEN
        resultado := resultado || '  ✅ kanban_cards RLS ATIVO (' || count_policies_cards || E' policies)\n';
      ELSE
        resultado := resultado || E'  ⚠️  kanban_cards RLS DESATIVADO\n';
      END IF;
      
      IF rls_kanban_atividades THEN
        resultado := resultado || '  ✅ kanban_atividades RLS ATIVO (' || count_policies_atividades || E' policies)\n';
      ELSE
        resultado := resultado || E'  ⚠️  kanban_atividades RLS DESATIVADO\n';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      resultado := resultado || E'  ⚠️  Erro ao verificar RLS: ' || SQLERRM || E'\n';
    END;
  END;
  
  -- 6. Resumo final
  resultado := resultado || E'\n=== RESUMO ===\n';
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('kanbans', 'kanban_fases', 'kanban_cards', 'kanban_atividades', 'feriados_nacionais')
  ) THEN
    resultado := resultado || E'✅ Sistema Funil Step One instalado\n';
  ELSE
    resultado := resultado || E'❌ Sistema Funil Step One NÃO instalado\n';
    resultado := resultado || E'\nPara instalar, execute as migrations:\n';
    resultado := resultado || E'  1. 091_step_one_kanban.sql\n';
    resultado := resultado || E'  2. 102_feriados_dias_uteis.sql\n';
    resultado := resultado || E'  3. 103_atividades_kanban.sql\n';
    resultado := resultado || E'  4. 104_atividades_add_time.sql\n';
  END IF;
  
  RAISE NOTICE '%', resultado;
END $$;

-- ========================================
-- QUERIES ADICIONAIS ÚTEIS
-- (Descomente para usar)
-- ========================================

-- Ver últimas 10 migrações aplicadas (se usar supabase_migrations)
-- SELECT version, name, applied_at 
-- FROM supabase_migrations.schema_migrations 
-- ORDER BY version DESC 
-- LIMIT 10;

-- Ver todas as tabelas que começam com 'kanban'
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
--   AND table_name LIKE 'kanban%';

-- Ver estrutura completa da tabela kanban_atividades
-- SELECT 
--   column_name, 
--   data_type, 
--   is_nullable,
--   column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'kanban_atividades'
-- ORDER BY ordinal_position;

-- Testar função de dias úteis
-- SELECT public.calcular_dias_uteis('2026-04-01'::DATE, '2026-04-15'::DATE);

-- Ver todos os cards do Funil Step One
-- SELECT 
--   c.id,
--   c.titulo,
--   f.nome AS fase,
--   c.status,
--   c.created_at
-- FROM kanban_cards c
-- JOIN kanban_fases f ON f.id = c.fase_id
-- JOIN kanbans k ON k.id = c.kanban_id
-- WHERE k.nome = 'Funil Step One'
-- ORDER BY c.created_at DESC;
