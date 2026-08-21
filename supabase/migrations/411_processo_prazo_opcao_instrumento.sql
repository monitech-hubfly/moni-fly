-- 411: Prazos de Opção e Instrumento Garantidor em Dados do Negócio (processo_step_one).

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS prazo_opcao_dias integer,
  ADD COLUMN IF NOT EXISTS prazo_opcao_sla_tipo text,
  ADD COLUMN IF NOT EXISTS prazo_opcao_modo text,
  ADD COLUMN IF NOT EXISTS prazo_opcao_fase_id uuid,
  ADD COLUMN IF NOT EXISTS prazo_opcao_data date,
  ADD COLUMN IF NOT EXISTS prazo_instrumento_garantidor_dias integer,
  ADD COLUMN IF NOT EXISTS prazo_instrumento_garantidor_sla_tipo text,
  ADD COLUMN IF NOT EXISTS prazo_instrumento_garantidor_modo text,
  ADD COLUMN IF NOT EXISTS prazo_instrumento_garantidor_fase_id uuid,
  ADD COLUMN IF NOT EXISTS prazo_instrumento_garantidor_data date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'processo_step_one_prazo_opcao_sla_tipo_check'
  ) THEN
    ALTER TABLE public.processo_step_one
      ADD CONSTRAINT processo_step_one_prazo_opcao_sla_tipo_check
      CHECK (prazo_opcao_sla_tipo IS NULL OR prazo_opcao_sla_tipo IN ('uteis', 'corridos'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'processo_step_one_prazo_opcao_modo_check'
  ) THEN
    ALTER TABLE public.processo_step_one
      ADD CONSTRAINT processo_step_one_prazo_opcao_modo_check
      CHECK (prazo_opcao_modo IS NULL OR prazo_opcao_modo IN ('fase', 'data'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'processo_step_one_prazo_instrumento_sla_tipo_check'
  ) THEN
    ALTER TABLE public.processo_step_one
      ADD CONSTRAINT processo_step_one_prazo_instrumento_sla_tipo_check
      CHECK (prazo_instrumento_garantidor_sla_tipo IS NULL OR prazo_instrumento_garantidor_sla_tipo IN ('uteis', 'corridos'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'processo_step_one_prazo_instrumento_modo_check'
  ) THEN
    ALTER TABLE public.processo_step_one
      ADD CONSTRAINT processo_step_one_prazo_instrumento_modo_check
      CHECK (prazo_instrumento_garantidor_modo IS NULL OR prazo_instrumento_garantidor_modo IN ('fase', 'data'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.processo_step_one.prazo_opcao_dias IS
  'Prazo Opção: dias a contar da fase âncora (modo fase) ou ignorado se modo data.';
COMMENT ON COLUMN public.processo_step_one.prazo_opcao_modo IS
  'Prazo Opção: fase = dias a partir de prazo_opcao_fase_id; data = prazo_opcao_data fixa.';
COMMENT ON COLUMN public.processo_step_one.prazo_instrumento_garantidor_dias IS
  'Prazo Instrumento Garantidor: dias a contar da fase âncora (modo fase).';
COMMENT ON COLUMN public.processo_step_one.prazo_instrumento_garantidor_modo IS
  'Instrumento Garantidor: fase ou data fixa.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('411', 'processo_prazo_opcao_instrumento')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
