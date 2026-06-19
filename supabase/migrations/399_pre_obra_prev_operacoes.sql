-- 399: Dados Pré Obra — campos prev_* + trigger de recálculo (Funil Operações)
-- prefeitura_aprovada_em: migration 393. Demais datas reais: IF NOT EXISTS (idempotente).

ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS condominio_aprovada_em timestamptz DEFAULT null;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS alvara_emitido_em timestamptz DEFAULT null;

ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS prev_aprovacao_condominio date;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS prev_aprovacao_prefeitura date;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS prev_emissao_alvara date;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS prev_envio_credito_obra date;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS prev_inicio_obra date;

COMMENT ON COLUMN public.kanban_cards.condominio_aprovada_em IS
  'Data real aprovação condomínio (Funil Operações).';
COMMENT ON COLUMN public.kanban_cards.alvara_emitido_em IS
  'Data real emissão alvará (Funil Operações).';

COMMENT ON COLUMN public.kanban_cards.prev_aprovacao_condominio IS
  'Previsão calculada: aprovação condomínio (Funil Operações).';
COMMENT ON COLUMN public.kanban_cards.prev_aprovacao_prefeitura IS
  'Previsão calculada: aprovação prefeitura (Funil Operações).';
COMMENT ON COLUMN public.kanban_cards.prev_emissao_alvara IS
  'Previsão calculada: emissão alvará (Funil Operações).';
COMMENT ON COLUMN public.kanban_cards.prev_envio_credito_obra IS
  'Previsão calculada: envio crédito obra — 30 dias antes da prefeitura (Funil Operações).';
COMMENT ON COLUMN public.kanban_cards.prev_inicio_obra IS
  'Previsão calculada: início obra — 30 dias após alvará (Funil Operações).';

-- Dias úteis seg–sex (sem feriados)
CREATE OR REPLACE FUNCTION public.fn_add_business_days(p_base date, p_days integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result date := p_base;
  v_added integer := 0;
BEGIN
  IF p_base IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_days IS NULL OR p_days <= 0 THEN
    RETURN p_base;
  END IF;

  WHILE v_added < p_days LOOP
    v_result := v_result + 1;
    IF EXTRACT(DOW FROM v_result) NOT IN (0, 6) THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_add_business_days(date, integer) IS
  'Soma dias úteis (seg–sex) a uma data. Sem feriados.';

-- SLA da fase por slug no kanban do card (nunca constante fixa no código)
CREATE OR REPLACE FUNCTION public.fn_kanban_fase_sla_dias(p_kanban_id uuid, p_slug text)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT kf.sla_dias
  FROM public.kanban_fases kf
  WHERE kf.kanban_id = p_kanban_id
    AND kf.slug = p_slug
    AND COALESCE(kf.ativo, true) = true
  ORDER BY kf.ordem
  LIMIT 1;
$$;

-- Entrada na fase (histórico ou entered_fase_at se fase atual)
CREATE OR REPLACE FUNCTION public.fn_kanban_card_entrada_fase_slug(
  p_card_id uuid,
  p_kanban_id uuid,
  p_fase_slug text,
  p_current_fase_id uuid,
  p_entered_fase_at timestamptz
)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH fase AS (
    SELECT kf.id
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = p_kanban_id
      AND kf.slug = p_fase_slug
      AND COALESCE(kf.ativo, true) = true
    ORDER BY kf.ordem
    LIMIT 1
  ),
  hist AS (
    SELECT MIN(kh.criado_em) AS entrou
    FROM public.kanban_historico kh
    CROSS JOIN fase f
    WHERE kh.card_id = p_card_id
      AND kh.acao IN ('fase_avancada', 'fase_retrocedida', 'card_criado')
      AND COALESCE(
            (kh.detalhe ->> 'fase_nova_id')::uuid,
            (kh.detalhe ->> 'fase_id')::uuid
          ) = f.id
  )
  SELECT COALESCE(
    CASE
      WHEN p_current_fase_id = (SELECT id FROM fase) AND p_entered_fase_at IS NOT NULL
        THEN p_entered_fase_at
    END,
    (SELECT entrou FROM hist)
  )::date;
$$;

CREATE OR REPLACE FUNCTION public.fn_kanban_cards_apply_prev_operacoes(p_row public.kanban_cards)
RETURNS public.kanban_cards
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_kanban_operacoes uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
  v_row public.kanban_cards := p_row;
  v_cond_real date;
  v_pref_real date;
  v_alvara_real date;
  v_entrada_cond date;
  v_entrada_pref date;
  v_sla_cond integer;
  v_sla_pref integer;
  v_base_pref date;
BEGIN
  IF v_row.kanban_id IS DISTINCT FROM v_kanban_operacoes THEN
    RETURN v_row;
  END IF;

  v_cond_real := v_row.condominio_aprovada_em::date;
  v_pref_real := v_row.prefeitura_aprovada_em::date;
  v_alvara_real := v_row.alvara_emitido_em::date;

  -- Aprovação Condomínio
  IF v_cond_real IS NOT NULL THEN
    v_row.prev_aprovacao_condominio := v_cond_real;
  ELSE
    v_entrada_cond := public.fn_kanban_card_entrada_fase_slug(
      v_row.id, v_row.kanban_id, 'aprovacao_condominio', v_row.fase_id, v_row.entered_fase_at
    );
    v_sla_cond := public.fn_kanban_fase_sla_dias(v_row.kanban_id, 'aprovacao_condominio');
    IF v_entrada_cond IS NOT NULL AND v_sla_cond IS NOT NULL THEN
      v_row.prev_aprovacao_condominio := public.fn_add_business_days(v_entrada_cond, v_sla_cond);
    ELSE
      v_row.prev_aprovacao_condominio := NULL;
    END IF;
  END IF;

  -- Aprovação Prefeitura
  IF v_pref_real IS NOT NULL THEN
    v_row.prev_aprovacao_prefeitura := v_pref_real;
  ELSE
    v_sla_pref := public.fn_kanban_fase_sla_dias(v_row.kanban_id, 'aprovacao_prefeitura');
    IF v_cond_real IS NOT NULL AND v_sla_pref IS NOT NULL THEN
      v_row.prev_aprovacao_prefeitura := public.fn_add_business_days(v_cond_real, v_sla_pref);
    ELSE
      v_entrada_pref := public.fn_kanban_card_entrada_fase_slug(
        v_row.id, v_row.kanban_id, 'aprovacao_prefeitura', v_row.fase_id, v_row.entered_fase_at
      );
      IF v_entrada_pref IS NOT NULL AND v_sla_pref IS NOT NULL THEN
        v_row.prev_aprovacao_prefeitura := public.fn_add_business_days(v_entrada_pref, v_sla_pref);
      ELSE
        v_row.prev_aprovacao_prefeitura := NULL;
      END IF;
    END IF;
  END IF;

  -- Emissão Alvará
  IF v_alvara_real IS NOT NULL THEN
    v_row.prev_emissao_alvara := v_alvara_real;
  ELSE
    v_base_pref := COALESCE(v_pref_real, v_row.prev_aprovacao_prefeitura);
    IF v_base_pref IS NOT NULL THEN
      v_row.prev_emissao_alvara := public.fn_add_business_days(v_base_pref, 3);
    ELSE
      v_row.prev_emissao_alvara := NULL;
    END IF;
  END IF;

  -- Envio Crédito Obra (30 dias corridos antes da prefeitura)
  v_base_pref := COALESCE(v_pref_real, v_row.prev_aprovacao_prefeitura);
  IF v_base_pref IS NOT NULL THEN
    v_row.prev_envio_credito_obra := v_base_pref - 30;
  ELSE
    v_row.prev_envio_credito_obra := NULL;
  END IF;

  -- Início Obra (30 dias corridos após alvará)
  IF v_alvara_real IS NOT NULL THEN
    v_row.prev_inicio_obra := v_alvara_real + 30;
  ELSIF v_row.prev_emissao_alvara IS NOT NULL THEN
    v_row.prev_inicio_obra := v_row.prev_emissao_alvara + 30;
  ELSE
    v_row.prev_inicio_obra := NULL;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_kanban_cards_recalc_prev_operacoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_kanban_operacoes uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
  v_calc public.kanban_cards;
BEGIN
  IF NEW.kanban_id IS DISTINCT FROM v_kanban_operacoes THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT (
    NEW.fase_id IS DISTINCT FROM OLD.fase_id
    OR NEW.entered_fase_at IS DISTINCT FROM OLD.entered_fase_at
    OR NEW.condominio_aprovada_em IS DISTINCT FROM OLD.condominio_aprovada_em
    OR NEW.prefeitura_aprovada_em IS DISTINCT FROM OLD.prefeitura_aprovada_em
    OR NEW.alvara_emitido_em IS DISTINCT FROM OLD.alvara_emitido_em
  ) THEN
    RETURN NEW;
  END IF;

  v_calc := public.fn_kanban_cards_apply_prev_operacoes(NEW);
  NEW.prev_aprovacao_condominio := v_calc.prev_aprovacao_condominio;
  NEW.prev_aprovacao_prefeitura := v_calc.prev_aprovacao_prefeitura;
  NEW.prev_emissao_alvara := v_calc.prev_emissao_alvara;
  NEW.prev_envio_credito_obra := v_calc.prev_envio_credito_obra;
  NEW.prev_inicio_obra := v_calc.prev_inicio_obra;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_cards_recalc_prev_operacoes ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_recalc_prev_operacoes
  BEFORE INSERT OR UPDATE ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_kanban_cards_recalc_prev_operacoes();

-- Backfill cards existentes do Funil Operações
DO $$
DECLARE
  v_kanban_operacoes uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
  r public.kanban_cards;
  v_calc public.kanban_cards;
BEGIN
  FOR r IN
    SELECT k.*
    FROM public.kanban_cards k
    WHERE k.kanban_id = v_kanban_operacoes
  LOOP
    v_calc := public.fn_kanban_cards_apply_prev_operacoes(r);
    UPDATE public.kanban_cards
    SET
      prev_aprovacao_condominio = v_calc.prev_aprovacao_condominio,
      prev_aprovacao_prefeitura = v_calc.prev_aprovacao_prefeitura,
      prev_emissao_alvara = v_calc.prev_emissao_alvara,
      prev_envio_credito_obra = v_calc.prev_envio_credito_obra,
      prev_inicio_obra = v_calc.prev_inicio_obra
    WHERE id = r.id;
  END LOOP;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('399', 'pre_obra_prev_operacoes')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
