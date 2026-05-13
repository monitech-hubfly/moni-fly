CREATE TABLE IF NOT EXISTS public.kanban_aprovacoes_fase (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id        UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  solicitado_por UUID        NOT NULL REFERENCES auth.users(id),
  fase_destino   TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pendente'
                             CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  aprovado_por   UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kanban_aprovacoes_card   ON public.kanban_aprovacoes_fase (card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_aprovacoes_status ON public.kanban_aprovacoes_fase (status);

ALTER TABLE public.kanban_aprovacoes_fase ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aprovacoes_select" ON public.kanban_aprovacoes_fase;
CREATE POLICY "aprovacoes_select" ON public.kanban_aprovacoes_fase
  FOR SELECT USING (
    solicitado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.sirene_papeis
      WHERE user_id = auth.uid() AND papel = 'bombeiro'
    )
  );

DROP POLICY IF EXISTS "aprovacoes_insert" ON public.kanban_aprovacoes_fase;
CREATE POLICY "aprovacoes_insert" ON public.kanban_aprovacoes_fase
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "aprovacoes_update_bombeiro" ON public.kanban_aprovacoes_fase;
CREATE POLICY "aprovacoes_update_bombeiro" ON public.kanban_aprovacoes_fase
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.sirene_papeis
      WHERE user_id = auth.uid() AND papel = 'bombeiro'
    )
  );
