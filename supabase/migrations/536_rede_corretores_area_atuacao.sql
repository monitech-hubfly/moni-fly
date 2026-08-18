-- 536: rede_corretores — área de atuação (UFs + cidades IBGE).
-- Idempotente.

ALTER TABLE public.rede_corretores
  ADD COLUMN IF NOT EXISTS atuacao_ufs TEXT[] DEFAULT '{}'::text[];

ALTER TABLE public.rede_corretores
  ADD COLUMN IF NOT EXISTS atuacao_cidades JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.rede_corretores.atuacao_ufs IS
  'Siglas UF de corretagem (multiselect).';
COMMENT ON COLUMN public.rede_corretores.atuacao_cidades IS
  'Cidades de corretagem: [{ "ibge_id": number, "nome": string, "uf": string }].';

CREATE INDEX IF NOT EXISTS idx_rede_corretores_atuacao_ufs
  ON public.rede_corretores USING GIN (atuacao_ufs);

CREATE INDEX IF NOT EXISTS idx_rede_corretores_atuacao_cidades
  ON public.rede_corretores USING GIN (atuacao_cidades);

NOTIFY pgrst, 'reload schema';
