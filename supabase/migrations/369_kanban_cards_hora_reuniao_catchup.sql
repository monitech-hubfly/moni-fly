-- 369: kanban_cards.hora_reuniao (DEV catch-up migration 344).

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS hora_reuniao TEXT;

COMMENT ON COLUMN public.kanban_cards.hora_reuniao IS
  'Horário da reunião (HH:MM), ex. Funil Loteadores Primeiro Contato.';

NOTIFY pgrst, 'reload schema';
