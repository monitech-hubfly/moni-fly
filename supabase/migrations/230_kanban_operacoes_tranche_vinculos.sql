-- Vínculos preset de tranche no Funil Operações (dados por card + índice 1–5).

CREATE TABLE IF NOT EXISTS public.kanban_operacoes_tranche_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacoes_card_id uuid NOT NULL REFERENCES public.kanban_cards (id) ON DELETE CASCADE,
  tranche_index smallint NOT NULL CHECK (tranche_index BETWEEN 1 AND 5),
  pct_fisico_financeiro numeric(5, 2),
  nfts_url text,
  evidencias_url text,
  concluido_em timestamptz,
  concluido_por uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operacoes_card_id, tranche_index)
);

CREATE INDEX IF NOT EXISTS idx_kanban_operacoes_tranche_vinculos_card
  ON public.kanban_operacoes_tranche_vinculos (operacoes_card_id, tranche_index);

COMMENT ON TABLE public.kanban_operacoes_tranche_vinculos IS
  'Vínculos preset de tranche (2ª–6ª) no Funil Operações; ao concluir move card filho Crédito Obra.';

ALTER TABLE public.kanban_operacoes_tranche_vinculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kanban_operacoes_tranche_vinculos_select ON public.kanban_operacoes_tranche_vinculos;
CREATE POLICY kanban_operacoes_tranche_vinculos_select
  ON public.kanban_operacoes_tranche_vinculos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards c
      WHERE c.id = kanban_operacoes_tranche_vinculos.operacoes_card_id
    )
  );

DROP POLICY IF EXISTS kanban_operacoes_tranche_vinculos_insert ON public.kanban_operacoes_tranche_vinculos;
CREATE POLICY kanban_operacoes_tranche_vinculos_insert
  ON public.kanban_operacoes_tranche_vinculos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kanban_cards c
      WHERE c.id = kanban_operacoes_tranche_vinculos.operacoes_card_id
    )
  );

DROP POLICY IF EXISTS kanban_operacoes_tranche_vinculos_update ON public.kanban_operacoes_tranche_vinculos;
CREATE POLICY kanban_operacoes_tranche_vinculos_update
  ON public.kanban_operacoes_tranche_vinculos FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards c
      WHERE c.id = kanban_operacoes_tranche_vinculos.operacoes_card_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kanban_cards c
      WHERE c.id = kanban_operacoes_tranche_vinculos.operacoes_card_id
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.kanban_operacoes_tranche_vinculos TO authenticated;
