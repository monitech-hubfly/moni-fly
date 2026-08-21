-- Tags por kanban e vínculo por card

CREATE TABLE IF NOT EXISTS public.kanban_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kanban_id uuid NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#F5A623',
  created_at timestamptz DEFAULT now(),
  UNIQUE(kanban_id, nome)
);

CREATE TABLE IF NOT EXISTS public.kanban_card_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.kanban_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(card_id, tag_id)
);

