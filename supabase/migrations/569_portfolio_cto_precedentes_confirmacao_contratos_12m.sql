-- 569: Portfólio — popup «Cto c/ Precedentes Assinado» + incremento automático de diag_contratos_12m
--
-- 1. Colunas de confirmação no card (equivalente às de opcao/comite/contrato em 389).
-- 2. Função SQL para incremento atômico de diag_contratos_12m em rede_franqueados.
-- 3. Preenchimento retroativo de diag_contratos_12m (valores fornecidos pela equipe).

-- ── 1. Colunas no card ───────────────────────────────────────────────────────
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS portfolio_cto_precedentes_assinado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS portfolio_cto_precedentes_assinado_em timestamptz DEFAULT null;

COMMENT ON COLUMN public.kanban_cards.portfolio_cto_precedentes_assinado IS
  'Portfólio: confirmação popup «O Cto c/ Precedentes foi assinado?» ao sair de Assinaturas Cto c/ Precedentes.';
COMMENT ON COLUMN public.kanban_cards.portfolio_cto_precedentes_assinado_em IS
  'Portfólio: timestamp da confirmação de assinatura do Cto c/ Precedentes.';

-- ── 2. Função de incremento atômico ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.incrementar_contratos_12m_rede(p_rede_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.rede_franqueados
  SET diag_contratos_12m = COALESCE(diag_contratos_12m, 0) + 1
  WHERE id = p_rede_id;
$$;

-- ── 3. Preenchimento retroativo de diag_contratos_12m ───────────────────────
-- Valores fornecidos pela equipe em 16/09/2026.
-- Usa CAST numérico para aceitar qualquer formato de n_franquia (FK0002, 2, 0002, etc.).
-- Idempotente: sobrescreve o valor sempre que o número extraído bate.
DO $$
DECLARE
  v_data JSONB := '[
    {"n": 0,  "v": 2},
    {"n": 1,  "v": 1},
    {"n": 2,  "v": 2},
    {"n": 4,  "v": 1},
    {"n": 6,  "v": 1},
    {"n": 7,  "v": 1},
    {"n": 8,  "v": 1},
    {"n": 10, "v": 1},
    {"n": 12, "v": 1},
    {"n": 20, "v": 2},
    {"n": 25, "v": 1},
    {"n": 30, "v": 1}
  ]'::jsonb;
  r JSONB;
  v_digits TEXT;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(v_data)
  LOOP
    UPDATE public.rede_franqueados
    SET diag_contratos_12m = (r->>'v')::int
    WHERE (
      regexp_replace(COALESCE(n_franquia, ''), '[^0-9]', '', 'g') <> ''
      AND CAST(regexp_replace(COALESCE(n_franquia, ''), '[^0-9]', '', 'g') AS INTEGER) = (r->>'n')::int
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
