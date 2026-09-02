-- 543: Entrada e Parcelas mensais por empreendimento/showroom IMOB.
-- Substitui na UI os blocos de balões × situação e financiamento bancário.

ALTER TABLE public.imob_card_empreendimentos
  ADD COLUMN IF NOT EXISTS entrada numeric(14,2),
  ADD COLUMN IF NOT EXISTS parcelas_mensais numeric(14,2);

COMMENT ON COLUMN public.imob_card_empreendimentos.entrada IS
  'Valor de entrada da simulação IMOB (por empreendimento/showroom).';
COMMENT ON COLUMN public.imob_card_empreendimentos.parcelas_mensais IS
  'Valor das parcelas mensais da simulação IMOB (por empreendimento/showroom).';

NOTIFY pgrst, 'reload schema';
