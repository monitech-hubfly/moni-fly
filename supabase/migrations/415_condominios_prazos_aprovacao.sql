-- 415: Prazos de aprovação no condomínio e na prefeitura (cadastro Rede Casa Moní).

ALTER TABLE public.condominios
  ADD COLUMN IF NOT EXISTS prazo_aprovacao_condominio_dias integer,
  ADD COLUMN IF NOT EXISTS prazo_aprovacao_condominio_sla_tipo text,
  ADD COLUMN IF NOT EXISTS prazo_aprovacao_prefeitura_dias integer,
  ADD COLUMN IF NOT EXISTS prazo_aprovacao_prefeitura_sla_tipo text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'condominios_prazo_cond_sla_tipo_check'
  ) THEN
    ALTER TABLE public.condominios
      ADD CONSTRAINT condominios_prazo_cond_sla_tipo_check
      CHECK (prazo_aprovacao_condominio_sla_tipo IS NULL OR prazo_aprovacao_condominio_sla_tipo IN ('uteis', 'corridos'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'condominios_prazo_pref_sla_tipo_check'
  ) THEN
    ALTER TABLE public.condominios
      ADD CONSTRAINT condominios_prazo_pref_sla_tipo_check
      CHECK (prazo_aprovacao_prefeitura_sla_tipo IS NULL OR prazo_aprovacao_prefeitura_sla_tipo IN ('uteis', 'corridos'));
  END IF;
END $$;

COMMENT ON COLUMN public.condominios.prazo_aprovacao_condominio_dias IS
  'SLA customizado (dias) para fase aprovacao_condominio na calculadora.';
COMMENT ON COLUMN public.condominios.prazo_aprovacao_condominio_sla_tipo IS
  'Contagem do prazo condomínio: uteis ou corridos.';
COMMENT ON COLUMN public.condominios.prazo_aprovacao_prefeitura_dias IS
  'SLA customizado (dias) para fase aprovacao_prefeitura na calculadora.';
COMMENT ON COLUMN public.condominios.prazo_aprovacao_prefeitura_sla_tipo IS
  'Contagem do prazo prefeitura: uteis ou corridos.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('415', 'condominios_prazos_aprovacao')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
