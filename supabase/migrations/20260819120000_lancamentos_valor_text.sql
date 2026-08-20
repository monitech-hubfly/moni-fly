-- ============================================================
-- Migração: indicador_lancamentos — valor text + RLS policies
-- Arquivo: supabase/migrations/20260819120000_lancamentos_valor_text.sql
--
-- INSTRUÇÃO:
--   1. Rode primeiro no DEV (bgaadvfucnrkpimaszjv) via:
--      npx supabase db query --linked --file supabase/migrations/20260819120000_lancamentos_valor_text.sql
--   2. Teste o lançamento de indicadores categoricos (SIM/NÃO) e numéricos.
--   3. Confirme antes de aplicar em PROD (aydryzoxqnwnbybvgiug).
--
-- O QUE FAZ:
--   • Converte coluna "valor" de numeric para text
--     (suporta tanto "75" quanto "SIM" / "NÃO" / texto livre)
--   • Garante que RLS está habilitado
--   • Adiciona políticas SELECT / INSERT / UPDATE para authenticated
-- ============================================================

-- 1. Converter coluna valor de numeric → text
--    (USING garante conversão segura dos valores existentes)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'indicador_lancamentos'
      AND column_name  = 'valor'
      AND data_type    = 'numeric'
  ) THEN
    ALTER TABLE indicador_lancamentos
      ALTER COLUMN valor TYPE text USING valor::text;

    RAISE NOTICE 'Coluna valor convertida de numeric para text.';
  ELSE
    RAISE NOTICE 'Coluna valor já é text ou não é numeric — nada alterado.';
  END IF;
END $$;

-- 2. Garantir que RLS está habilitado
ALTER TABLE indicador_lancamentos ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas antigas (idempotente) e recriar
DROP POLICY IF EXISTS "indicador_lancamentos_select"  ON indicador_lancamentos;
DROP POLICY IF EXISTS "indicador_lancamentos_insert"  ON indicador_lancamentos;
DROP POLICY IF EXISTS "indicador_lancamentos_update"  ON indicador_lancamentos;
DROP POLICY IF EXISTS "indicador_lancamentos_delete"  ON indicador_lancamentos;

-- SELECT: qualquer usuário autenticado pode ler (filtragem acontece no app)
CREATE POLICY "indicador_lancamentos_select"
  ON indicador_lancamentos
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: usuário só pode inserir lançamentos com seu próprio profile_id
CREATE POLICY "indicador_lancamentos_insert"
  ON indicador_lancamentos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = profile_id
    OR profile_id IS NULL   -- suporte a linhas legadas sem profile_id
  );

-- UPDATE: usuário só pode alterar seus próprios lançamentos
CREATE POLICY "indicador_lancamentos_update"
  ON indicador_lancamentos
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = profile_id
    OR profile_id IS NULL
  );

-- (sem policy de DELETE — não há deleção de lançamentos no app)

-- 4. Verificação final
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'indicador_lancamentos'
ORDER BY cmd;
