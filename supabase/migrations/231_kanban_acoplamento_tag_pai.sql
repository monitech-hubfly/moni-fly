-- Tag do card pai (Portfólio): fase atual do filho no Funil Acoplamento
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS acoplamento_filho_fase_slug text,
  ADD COLUMN IF NOT EXISTS acoplamento_filho_fase_nome text;

COMMENT ON COLUMN public.kanban_cards.acoplamento_filho_fase_slug IS
  'Slug da fase do card filho no Funil Acoplamento (origem_card_id = este card).';
COMMENT ON COLUMN public.kanban_cards.acoplamento_filho_fase_nome IS
  'Nome exibido da fase do filho Acoplamento — reflete na tag/chip do card pai.';
