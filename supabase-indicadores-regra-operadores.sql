-- Operador de comparação por faixa da regra de coloração (≥, ≤, =, >, <, ≠).
-- Rode no Supabase → SQL Editor (após as colunas regra_verde_escuro, regra_verde_claro, regra_amarelo existirem).

ALTER TABLE indicadores
  ADD COLUMN IF NOT EXISTS regra_verde_escuro_op text DEFAULT 'gte' CHECK (regra_verde_escuro_op IS NULL OR regra_verde_escuro_op IN ('gte', 'lte', 'eq', 'gt', 'lt', 'ne')),
  ADD COLUMN IF NOT EXISTS regra_verde_claro_op text DEFAULT 'gte' CHECK (regra_verde_claro_op IS NULL OR regra_verde_claro_op IN ('gte', 'lte', 'eq', 'gt', 'lt', 'ne')),
  ADD COLUMN IF NOT EXISTS regra_amarelo_op text DEFAULT 'gte' CHECK (regra_amarelo_op IS NULL OR regra_amarelo_op IN ('gte', 'lte', 'eq', 'gt', 'lt', 'ne'));

COMMENT ON COLUMN indicadores.regra_verde_escuro_op IS 'Operador: gte=≥, lte=≤, eq==, gt=>, lt=<, ne=≠. Padrão gte.';
COMMENT ON COLUMN indicadores.regra_verde_claro_op IS 'Operador: gte=≥, lte=≤, eq==, gt=>, lt=<, ne=≠. Padrão gte.';
COMMENT ON COLUMN indicadores.regra_amarelo_op IS 'Operador: gte=≥, lte=≤, eq==, gt=>, lt=<, ne=≠. Padrão gte.';
