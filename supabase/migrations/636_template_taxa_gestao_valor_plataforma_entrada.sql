-- 636: Colunas reais de gestão fixo e plataforma na entrada.
-- Idempotente. Aplicar só em DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Não altera PROD.

ALTER TABLE public.loteamento_simulador_templates
  ADD COLUMN IF NOT EXISTS tipo_taxa_gestao text NOT NULL DEFAULT 'percentual',
  ADD COLUMN IF NOT EXISTS taxa_gestao_valor numeric,
  ADD COLUMN IF NOT EXISTS percentual_plataforma_entrada numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE public.loteamento_simulador_templates
    DROP CONSTRAINT IF EXISTS loteamento_simulador_templates_tipo_taxa_gestao_check;
  ALTER TABLE public.loteamento_simulador_templates
    ADD CONSTRAINT loteamento_simulador_templates_tipo_taxa_gestao_check
    CHECK (tipo_taxa_gestao IN ('percentual', 'fixo'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.loteamento_simulador_templates.tipo_taxa_gestao IS
  'percentual | fixo. percentual usa pct_taxa_gestao (fração). fixo usa taxa_gestao_valor (R$).';
COMMENT ON COLUMN public.loteamento_simulador_templates.taxa_gestao_valor IS
  'Valor absoluto em R$ quando tipo_taxa_gestao = fixo.';
COMMENT ON COLUMN public.loteamento_simulador_templates.percentual_plataforma_entrada IS
  'Fração da taxa de plataforma cobrada na entrada (0.10=10%). 0 = diluir na obra.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'loteamento_simulador_templates'
      AND column_name = 'pct_plataforma_entrada'
  ) THEN
    UPDATE public.loteamento_simulador_templates
    SET percentual_plataforma_entrada = pct_plataforma_entrada
    WHERE COALESCE(percentual_plataforma_entrada, 0) = 0
      AND COALESCE(pct_plataforma_entrada, 0) <> 0;
  END IF;
END $$;

UPDATE public.loteamento_simulador_templates
SET taxa_gestao_valor = pct_taxa_gestao
WHERE tipo_taxa_gestao = 'fixo'
  AND taxa_gestao_valor IS NULL
  AND pct_taxa_gestao IS NOT NULL
  AND pct_taxa_gestao >= 1;

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('636', 'template_taxa_gestao_valor_plataforma_entrada')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('636')
    ON CONFLICT (version) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
