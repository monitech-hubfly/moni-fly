-- 150: Tokens de formulário público para candidatos (por card + fase)

CREATE TABLE IF NOT EXISTS public.kanban_card_form_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_id    UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  usado_em   TIMESTAMPTZ,
  created_by UUID        REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_form_tokens_card  ON public.kanban_card_form_tokens(card_id);
CREATE INDEX IF NOT EXISTS idx_card_form_tokens_token ON public.kanban_card_form_tokens(token);

ALTER TABLE public.kanban_card_form_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_tokens_select_interno" ON public.kanban_card_form_tokens;
CREATE POLICY "form_tokens_select_interno" ON public.kanban_card_form_tokens
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "form_tokens_insert_interno" ON public.kanban_card_form_tokens;
CREATE POLICY "form_tokens_insert_interno" ON public.kanban_card_form_tokens
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON public.kanban_card_form_tokens TO authenticated;

NOTIFY pgrst, 'reload schema';
