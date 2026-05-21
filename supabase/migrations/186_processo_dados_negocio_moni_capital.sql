-- Dados do Negócio: links e comentários Moní Capital.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS link_moni_capital_seguro_garantia TEXT,
  ADD COLUMN IF NOT EXISTS comentario_moni_capital_seguro_garantia TEXT,
  ADD COLUMN IF NOT EXISTS link_moni_capital_gastos_aporte_inicial TEXT,
  ADD COLUMN IF NOT EXISTS comentario_moni_capital_gastos_aporte_inicial TEXT;

COMMENT ON COLUMN public.processo_step_one.link_moni_capital_seguro_garantia IS 'Link Moní Capital — seguro garantia.';
COMMENT ON COLUMN public.processo_step_one.comentario_moni_capital_seguro_garantia IS 'Comentários sobre Moní Capital — seguro garantia.';
COMMENT ON COLUMN public.processo_step_one.link_moni_capital_gastos_aporte_inicial IS 'Link Moní Capital — gastos de aporte inicial.';
COMMENT ON COLUMN public.processo_step_one.comentario_moni_capital_gastos_aporte_inicial IS 'Comentários sobre Moní Capital — gastos de aporte inicial.';
