-- Migration: add capital_valor_declarado to formularios_qualificacao
-- Context: new Capital section asks for declared amount when franqueado selects "Abaixo de R$ 260.000"
-- Also updates capital_faixa values: new options are nao_tenho | abaixo_260k | 260_400k | 400_600k | acima_600k

ALTER TABLE formularios_qualificacao
  ADD COLUMN IF NOT EXISTS capital_valor_declarado text;

NOTIFY pgrst, 'reload schema';
