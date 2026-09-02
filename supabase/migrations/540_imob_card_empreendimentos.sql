-- 540: parâmetros de Simulações IMOB no card do Funil Loteadores.
-- 23 campos por empreendimento (2 gerais + 9 balões + 12 financiamento).
-- Campos do cliente (quitado, sinal, parcela mensal) NÃO entram aqui.

CREATE TABLE IF NOT EXISTS public.imob_card_empreendimentos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id             uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  ordem               integer NOT NULL DEFAULT 0,
  nome                text,
  valor_avista        numeric(14,2),
  balao_parcial_8     numeric(14,2),
  balao_parcial_18    numeric(14,2),
  balao_parcial_24    numeric(14,2),
  balao_quitado_8     numeric(14,2),
  balao_quitado_18    numeric(14,2),
  balao_quitado_24    numeric(14,2),
  balao_lote_8        numeric(14,2),
  balao_lote_18       numeric(14,2),
  balao_lote_24       numeric(14,2),
  fin_parcial_valor   numeric(14,2),
  fin_parcial_p1      numeric(14,2),
  fin_parcial_ultima  numeric(14,2),
  fin_parcial_total   numeric(14,2),
  fin_quitado_valor   numeric(14,2),
  fin_quitado_p1      numeric(14,2),
  fin_quitado_ultima  numeric(14,2),
  fin_quitado_total   numeric(14,2),
  fin_lote_valor      numeric(14,2),
  fin_lote_p1         numeric(14,2),
  fin_lote_ultima     numeric(14,2),
  fin_lote_total      numeric(14,2),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imob_card_empreendimentos_card
  ON public.imob_card_empreendimentos (card_id, ordem);

COMMENT ON TABLE public.imob_card_empreendimentos IS
  'Parâmetros de simulação IMOB por empreendimento no card do Funil Loteadores (23 campos).';

ALTER TABLE public.imob_card_empreendimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imob_card_emp_select_auth" ON public.imob_card_empreendimentos;
CREATE POLICY "imob_card_emp_select_auth"
  ON public.imob_card_empreendimentos
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "imob_card_emp_write_admin_team" ON public.imob_card_empreendimentos;
CREATE POLICY "imob_card_emp_write_admin_team"
  ON public.imob_card_empreendimentos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

GRANT SELECT ON public.imob_card_empreendimentos TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imob_card_empreendimentos TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
