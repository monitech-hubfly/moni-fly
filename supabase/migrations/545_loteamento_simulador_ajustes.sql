-- 545: Ajustes do template do Simulador de Pagamentos.
-- Colunas novas: prazo_obra_meses, entrada_minima_loteadora.
-- Default de juros do crédito-ponte: 2,5% (0.025).
-- Idempotente. Aplicar só em DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Não altera PROD.

ALTER TABLE public.loteamento_simulador_templates
  ADD COLUMN IF NOT EXISTS prazo_obra_meses INTEGER NOT NULL DEFAULT 7;

ALTER TABLE public.loteamento_simulador_templates
  ADD COLUMN IF NOT EXISTS entrada_minima_loteadora JSONB;

UPDATE public.loteamento_simulador_templates
SET prazo_obra_meses = prazo_desembolso_sugerido
WHERE prazo_desembolso_sugerido IS NOT NULL
  AND prazo_desembolso_sugerido >= 3
  AND (prazo_obra_meses IS DISTINCT FROM prazo_desembolso_sugerido);

UPDATE public.loteamento_simulador_templates
SET entrada_minima_loteadora = COALESCE(
  entrada_minima_loteadora,
  premissa_entrada_lote_nao_pago,
  premissa_entrada_lote_parcial
)
WHERE entrada_minima_loteadora IS NULL
  AND (premissa_entrada_lote_nao_pago IS NOT NULL
    OR premissa_entrada_lote_parcial IS NOT NULL);

ALTER TABLE public.loteamento_simulador_templates
  ALTER COLUMN taxa_juros_credito_ponte SET DEFAULT 0.025;

DO $$
BEGIN
  ALTER TABLE public.loteamento_simulador_templates
    ADD CONSTRAINT loteamento_simulador_templates_prazo_obra_check
    CHECK (prazo_obra_meses >= 3);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.loteamento_simulador_templates.prazo_obra_meses IS
  'Prazo de desembolsos da obra em meses (default 7, mínimo 3). Sucessor de prazo_desembolso_sugerido na UI.';
COMMENT ON COLUMN public.loteamento_simulador_templates.entrada_minima_loteadora IS
  'Entrada mínima exigida pela loteadora. Ex.: {"tipo":"percentual","valor":0.3} ou {"tipo":"valor_fixo","valor":50000}. O valor já pago pelo cliente é da oferta, não do template.';
COMMENT ON COLUMN public.loteamento_simulador_templates.taxa_juros_credito_ponte IS
  'Taxa mensal do crédito-ponte, fração decimal (default 0.025 = 2,5% a.m.).';

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('545', 'loteamento_simulador_ajustes')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('545')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
