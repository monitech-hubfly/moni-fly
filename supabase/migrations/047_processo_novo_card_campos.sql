-- Campos do formulário Novo Card (Nova Casa Moní Estudo)
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS nome_franqueado TEXT,
  ADD COLUMN IF NOT EXISTS email_franqueado TEXT,
  ADD COLUMN IF NOT EXISTS nome_condominio TEXT,
  ADD COLUMN IF NOT EXISTS quadra_lote TEXT,
  ADD COLUMN IF NOT EXISTS valor_terreno TEXT,
  ADD COLUMN IF NOT EXISTS vgv_pretendido TEXT,
  ADD COLUMN IF NOT EXISTS produto_modelo_casa TEXT,
  ADD COLUMN IF NOT EXISTS link_pasta_drive TEXT;

COMMENT ON COLUMN public.processo_step_one.nome_franqueado IS 'Nome completo do franqueado (formulário Novo Card).';
COMMENT ON COLUMN public.processo_step_one.email_franqueado IS 'E-mail do franqueado (formulário Novo Card).';
COMMENT ON COLUMN public.processo_step_one.nome_condominio IS 'Nome do condomínio (formulário Novo Card).';
COMMENT ON COLUMN public.processo_step_one.quadra_lote IS 'Quadra e lote, se definido (formulário Novo Card).';
COMMENT ON COLUMN public.processo_step_one.valor_terreno IS 'Valor do terreno (formulário Novo Card).';
COMMENT ON COLUMN public.processo_step_one.vgv_pretendido IS 'VGV pretendido (formulário Novo Card).';
COMMENT ON COLUMN public.processo_step_one.produto_modelo_casa IS 'Produto/Modelo da casa: Lis, Cissa, Gal, Ivy, Eva, Mia, Sol (formulário Novo Card).';
COMMENT ON COLUMN public.processo_step_one.link_pasta_drive IS 'Link da pasta no drive compartilhado (formulário Novo Card).';
