-- Adiciona timestamp de quando a atribuição foi aceita em sirene_topicos
ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS atribuicao_aceito_em TIMESTAMPTZ;

COMMENT ON COLUMN public.sirene_topicos.atribuicao_aceito_em
  IS 'Quando o responsável aceitou (ou o sistema auto-aceitou) a atribuição. Base para cálculo de SLA de 24h.';

-- Backfill 1: extrai do historico JSONB o primeiro evento "Atribuição aceita"
UPDATE public.sirene_topicos
SET atribuicao_aceito_em = (
  SELECT (elem->>'em')::timestamptz
  FROM jsonb_array_elements(historico) AS elem
  WHERE elem->>'tipo' = 'Atribuição aceita'
  ORDER BY (elem->>'em')::timestamptz ASC
  LIMIT 1
)
WHERE atribuicao_status = 'aceito'
  AND historico IS NOT NULL
  AND jsonb_array_length(historico) > 0
  AND atribuicao_aceito_em IS NULL;

-- Backfill 2: auto-aceitos (sem responsável) usam created_at
UPDATE public.sirene_topicos
SET atribuicao_aceito_em = created_at
WHERE atribuicao_status = 'aceito'
  AND atribuicao_aceito_em IS NULL;
