-- 163: kanban_cards — garantir concluido/arquivado NOT NULL DEFAULT false
--      + policy SELECT para admin/team verem todos os cards (além do dono).
--
-- Contexto: listagens usam .eq('concluido', false); valores NULL não passam.
-- RLS: team precisa de ramo explícito; só INSERT/UPDATE/DELETE tinham sido alargados na 162.

-- ─── 1) Normalizar nulos (antes de NOT NULL) ─────────────────────────────────
UPDATE public.kanban_cards SET concluido = false WHERE concluido IS NULL;
UPDATE public.kanban_cards SET arquivado = false WHERE arquivado IS NULL;

-- ─── 2) Defaults e NOT NULL (idempotente se já estiver correto) ──────────────
ALTER TABLE public.kanban_cards
  ALTER COLUMN concluido SET DEFAULT false,
  ALTER COLUMN concluido SET NOT NULL;

ALTER TABLE public.kanban_cards
  ALTER COLUMN arquivado SET DEFAULT false,
  ALTER COLUMN arquivado SET NOT NULL;

-- ─── 3) SELECT: visão ampla (admin, team — pedido 163) + consultor/supervisor
--     para alinhar a `visaoAmplaCards` em funil-moni-inc/page.tsx e Step One.
DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;

CREATE POLICY "kanban_cards_select"
  ON public.kanban_cards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
    OR franqueado_id = auth.uid()
  );
