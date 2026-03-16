-- Campos para integração ZAP (Etapa 4): cidade, estado, status (a venda/despublicado), compatibilidade Moní

ALTER TABLE public.listings_casas
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'a_venda' CHECK (status IS NULL OR status IN ('a_venda', 'despublicado')),
  ADD COLUMN IF NOT EXISTS compatibilidade_moni TEXT;

COMMENT ON COLUMN public.listings_casas.cidade IS 'Cidade do anúncio (ex.: São Paulo)';
COMMENT ON COLUMN public.listings_casas.estado IS 'UF (ex.: SP)';
COMMENT ON COLUMN public.listings_casas.status IS 'a_venda = ativo na ZAP; despublicado = saiu do ar (mantido na tabela)';
COMMENT ON COLUMN public.listings_casas.compatibilidade_moni IS 'Preenchido caso a caso (compatibilidade estilo Moní)';

CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_casas_processo_link ON public.listings_casas(processo_id, link) WHERE link IS NOT NULL;
