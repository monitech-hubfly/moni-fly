-- 546: Novos campos do Simulador (template + ofertas).
-- Template: juros parcelado (a.m., sem default) e juros do financiamento (a.a., default 10%).
-- Ofertas: valores do lote/casa, prazo, renda e financiamento.
-- Idempotente. Aplicar só em DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Não altera PROD.

ALTER TABLE public.loteamento_simulador_templates
  ADD COLUMN IF NOT EXISTS taxa_juros_parcelado_mes NUMERIC;

ALTER TABLE public.loteamento_simulador_templates
  ADD COLUMN IF NOT EXISTS taxa_juros_financiamento_anual NUMERIC DEFAULT 0.10;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS valor_lote NUMERIC;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS valor_casa NUMERIC;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS valor_customizacao NUMERIC;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS valor_ja_pago NUMERIC DEFAULT 0;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS prazo_meses INTEGER;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS renda_cliente NUMERIC;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS prazo_financiamento_anos INTEGER;

ALTER TABLE public.simulacoes_pagamento
  ADD COLUMN IF NOT EXISTS taxa_financiamento_anual NUMERIC DEFAULT 0.10;

COMMENT ON COLUMN public.loteamento_simulador_templates.taxa_juros_parcelado_mes IS
  'Taxa mensal para pagamento parcelado à loteadora, fração decimal (ex.: 0.02 = 2% a.m.). Sem default.';
COMMENT ON COLUMN public.loteamento_simulador_templates.taxa_juros_financiamento_anual IS
  'Taxa anual do financiamento bancário, fração decimal (default 0.10 = 10% a.a.).';
COMMENT ON COLUMN public.simulacoes_pagamento.valor_lote IS
  'Valor do lote à vista nesta oferta.';
COMMENT ON COLUMN public.simulacoes_pagamento.valor_casa IS
  'Valor da casa nesta oferta.';
COMMENT ON COLUMN public.simulacoes_pagamento.valor_customizacao IS
  'Valor da customização nesta oferta.';
COMMENT ON COLUMN public.simulacoes_pagamento.valor_ja_pago IS
  'Valor já pago à loteadora; desconta da entrada mínima exigida.';
COMMENT ON COLUMN public.simulacoes_pagamento.prazo_meses IS
  'Prazo total de pagamento em meses.';
COMMENT ON COLUMN public.simulacoes_pagamento.renda_cliente IS
  'Renda informada do cliente nesta oferta.';
COMMENT ON COLUMN public.simulacoes_pagamento.prazo_financiamento_anos IS
  'Tempo de financiamento bancário em anos.';
COMMENT ON COLUMN public.simulacoes_pagamento.taxa_financiamento_anual IS
  'Taxa anual do financiamento nesta oferta (fração; default 0.10).';

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('546', 'simulador_novos_campos')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('546')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
