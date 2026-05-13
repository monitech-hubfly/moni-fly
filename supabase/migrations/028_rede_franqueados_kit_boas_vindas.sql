-- Data de Recebimento do Kit de Boas Vindas (presente no CSV da planilha)
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS data_recebimento_kit_boas_vindas DATE;
