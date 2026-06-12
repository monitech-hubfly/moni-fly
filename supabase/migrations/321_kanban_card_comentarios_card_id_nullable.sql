-- Allow comments on Sirene chamados without a kanban card
ALTER TABLE public.kanban_card_comentarios ALTER COLUMN card_id DROP NOT NULL;
