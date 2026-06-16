-- Listagens importadas de planilha (Etapa 4 / Mapa de Competidores)
ALTER TABLE public.listings_casas
  ADD COLUMN IF NOT EXISTS importado BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.listings_casas.importado IS
  'true = linha importada de planilha (.xlsx/.csv); false = ZAP ou cadastro manual unitário';
