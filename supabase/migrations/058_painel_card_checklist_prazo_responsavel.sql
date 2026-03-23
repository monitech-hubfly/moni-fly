-- Painel Novos Negócios: checklist por card com prazo e responsável

ALTER TABLE public.processo_card_checklist
  ADD COLUMN IF NOT EXISTS prazo TEXT;

ALTER TABLE public.processo_card_checklist
  ADD COLUMN IF NOT EXISTS responsavel_nome TEXT;

