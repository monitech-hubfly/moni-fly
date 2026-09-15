-- 550: Parcela única + vínculo da oferta Helena no empreendimento IMOB.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Não aplicar em PROD sem revisão da Ingrid.

ALTER TABLE public.imob_card_empreendimentos
  ADD COLUMN IF NOT EXISTS parcela_unica numeric(14,2),
  ADD COLUMN IF NOT EXISTS simulacao_pagamento_id uuid REFERENCES public.simulacoes_pagamento(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.imob_card_empreendimentos.parcela_unica IS
  'Parcela única da oferta Helena (confirmada ?? sugerida), somente leitura no card.';
COMMENT ON COLUMN public.imob_card_empreendimentos.simulacao_pagamento_id IS
  'Oferta do Simulador de Pagamentos vinculada a este empreendimento (1:1).';

CREATE UNIQUE INDEX IF NOT EXISTS uq_imob_card_emp_simulacao
  ON public.imob_card_empreendimentos (simulacao_pagamento_id)
  WHERE simulacao_pagamento_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
