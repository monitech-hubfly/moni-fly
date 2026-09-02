-- 484: flag Portfólio — contrato com condições precedentes (popup ao sair do Comitê)
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS contrato_condicoes_precedentes boolean DEFAULT null;

COMMENT ON COLUMN public.kanban_cards.contrato_condicoes_precedentes IS
  'Portfólio: true = Diligência encadeia após Cto Condições Precedentes; false = após Comitê.';

NOTIFY pgrst, 'reload schema';
