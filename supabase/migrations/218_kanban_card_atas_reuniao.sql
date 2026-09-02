-- 218: atas de reunião por card (nativo e legado)

CREATE TABLE IF NOT EXISTS public.kanban_card_atas_reuniao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL,
  card_origem text NOT NULL DEFAULT 'nativo' CHECK (card_origem IN ('nativo', 'legado')),
  data_reuniao date NOT NULL,
  assunto text NOT NULL,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  preenchido_por uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_card_atas_reuniao_card
  ON public.kanban_card_atas_reuniao (card_id, card_origem, created_at DESC);

COMMENT ON TABLE public.kanban_card_atas_reuniao IS
  'Histórico de atas de reunião vinculadas a cards kanban ou processos legados.';

ALTER TABLE public.kanban_card_atas_reuniao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kanban_card_atas_reuniao_select ON public.kanban_card_atas_reuniao;
CREATE POLICY kanban_card_atas_reuniao_select
  ON public.kanban_card_atas_reuniao FOR SELECT TO authenticated
  USING (
    (card_origem = 'nativo' AND EXISTS (
      SELECT 1 FROM public.kanban_cards c WHERE c.id = kanban_card_atas_reuniao.card_id
    ))
    OR (card_origem = 'legado' AND EXISTS (
      SELECT 1 FROM public.processo_step_one p WHERE p.id = kanban_card_atas_reuniao.card_id
    ))
  );

DROP POLICY IF EXISTS kanban_card_atas_reuniao_insert ON public.kanban_card_atas_reuniao;
CREATE POLICY kanban_card_atas_reuniao_insert
  ON public.kanban_card_atas_reuniao FOR INSERT TO authenticated
  WITH CHECK (
    preenchido_por = auth.uid()
    AND (
      (card_origem = 'nativo' AND EXISTS (
        SELECT 1 FROM public.kanban_cards c WHERE c.id = kanban_card_atas_reuniao.card_id
      ))
      OR (card_origem = 'legado' AND EXISTS (
        SELECT 1 FROM public.processo_step_one p WHERE p.id = kanban_card_atas_reuniao.card_id
      ))
    )
  );

GRANT SELECT, INSERT ON public.kanban_card_atas_reuniao TO authenticated;
