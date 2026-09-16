-- 548: nome livre da oferta no Simulador de Pagamentos.
-- Idempotente. Aplicar só em DEV: bgaadvfucnrkpimaszjv
-- Não altera PROD.

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS nome text;

COMMENT ON COLUMN public.simulacoes_pagamento.nome IS
  'Nome livre da oferta, preenchido na criação (ex.: Oferta João Silva — Lote 12).';

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('548', 'simulador_oferta_nome')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('548')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
