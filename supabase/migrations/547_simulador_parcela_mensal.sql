-- 547: parcela_mensal nas simulações do Simulador de Pagamentos.
-- Idempotente. Aplicar só em DEV: bgaadvfucnrkpimaszjv
-- Não altera PROD.

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS parcela_mensal NUMERIC;

COMMENT ON COLUMN public.simulacoes_pagamento.parcela_mensal IS
  'Parcela mensal da oferta (Fase 1 e obra), em R$.';

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('547', 'simulador_parcela_mensal')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('547')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
