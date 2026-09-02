-- Migration 509: Alterar escala D/C/K de (0, 2, 3) para (0, 1, 2)
-- Escala anterior: 0=Não tem, 2=Moderado, 3=Tem
-- Escala nova:     0=Não tem, 1=Moderado, 2=Tem

-- 1. Remover constraints antigas primeiro (necessário antes dos UPDATEs)
ALTER TABLE rede_franqueados
  DROP CONSTRAINT IF EXISTS rede_franqueados_diag_d_check,
  DROP CONSTRAINT IF EXISTS rede_franqueados_diag_c_check,
  DROP CONSTRAINT IF EXISTS rede_franqueados_diag_k_check;

-- 2. Converter valores existentes: escala antiga → escala nova
--    Todos os 2s (Moderado antigo) → 1; todos os 3s (Tem) → 2
UPDATE rede_franqueados SET
  diag_d = CASE WHEN diag_d = 3 THEN 2 WHEN diag_d = 2 THEN 1 ELSE diag_d END,
  diag_c = CASE WHEN diag_c = 3 THEN 2 WHEN diag_c = 2 THEN 1 ELSE diag_c END,
  diag_k = CASE WHEN diag_k = 3 THEN 2 WHEN diag_k = 2 THEN 1 ELSE diag_k END
WHERE diag_d IN (2, 3) OR diag_c IN (2, 3) OR diag_k IN (2, 3);

-- 3. Adicionar novas constraints
ALTER TABLE rede_franqueados
  ADD CONSTRAINT rede_franqueados_diag_d_check CHECK (diag_d IN (0, 1, 2)),
  ADD CONSTRAINT rede_franqueados_diag_c_check CHECK (diag_c IN (0, 1, 2)),
  ADD CONSTRAINT rede_franqueados_diag_k_check CHECK (diag_k IN (0, 1, 2));

NOTIFY pgrst, 'reload schema';
