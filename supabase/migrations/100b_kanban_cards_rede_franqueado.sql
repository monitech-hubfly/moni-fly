-- ─── 100: Vínculo kanban_cards → rede_franqueados ────────────────────────────
-- Adiciona rede_franqueado_id para rastrear o franqueado de origem do card
-- e permitir auto-preenchimento do título no formulário.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS rede_franqueado_id UUID
    REFERENCES public.rede_franqueados(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_rede_franqueado
  ON public.kanban_cards(rede_franqueado_id);
