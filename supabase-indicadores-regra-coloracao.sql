-- Regra de coloração por indicador (opcional; null = usar padrão do sistema)
-- Rode no Supabase → SQL Editor (após a tabela indicadores existir).

ALTER TABLE indicadores
  ADD COLUMN IF NOT EXISTS regra_verde_escuro int CHECK (regra_verde_escuro IS NULL OR (regra_verde_escuro >= 0 AND regra_verde_escuro <= 100)),
  ADD COLUMN IF NOT EXISTS regra_verde_claro int CHECK (regra_verde_claro IS NULL OR (regra_verde_claro >= 0 AND regra_verde_claro <= 100)),
  ADD COLUMN IF NOT EXISTS regra_amarelo int CHECK (regra_amarelo IS NULL OR (regra_amarelo >= 0 AND regra_amarelo <= 100));

COMMENT ON COLUMN indicadores.regra_verde_escuro IS 'Percentual mínimo para farol verde escuro (≥). Padrão 75.';
COMMENT ON COLUMN indicadores.regra_verde_claro IS 'Percentual mínimo para farol verde claro (≥). Padrão 60.';
COMMENT ON COLUMN indicadores.regra_amarelo IS 'Percentual mínimo para farol amarelo (≥). Abaixo = vermelho. Padrão 30.';
