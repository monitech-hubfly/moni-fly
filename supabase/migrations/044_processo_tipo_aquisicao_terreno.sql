-- Tipo de aquisição do terreno: se = 'Permuta', a etapa Crédito Terreno é desconsiderada no Painel
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS tipo_aquisicao_terreno TEXT;

COMMENT ON COLUMN public.processo_step_one.tipo_aquisicao_terreno IS 'Ex.: Compra, Permuta. Se Permuta, a esteira Crédito Terreno não se aplica.';
