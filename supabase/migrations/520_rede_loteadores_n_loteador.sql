-- 520: N do Loteador (LO####) — análogo a rede_franqueados.n_franquia.
-- Idempotente. Não apaga codigo legado (LT).

ALTER TABLE public.rede_loteadores
  ADD COLUMN IF NOT EXISTS n_loteador TEXT,
  ADD COLUMN IF NOT EXISTS ordem INTEGER;

-- Backfill: LO já gravado, senão converte LTxxxx → LOxxxx, senão sequencial.
UPDATE public.rede_loteadores
SET n_loteador = upper(btrim(n_loteador))
WHERE n_loteador IS NOT NULL AND btrim(n_loteador) <> '' AND n_loteador <> upper(btrim(n_loteador));

UPDATE public.rede_loteadores
SET n_loteador = upper(btrim(codigo))
WHERE (n_loteador IS NULL OR btrim(n_loteador) = '')
  AND codigo ~* '^LO[0-9]+$';

UPDATE public.rede_loteadores
SET n_loteador = 'LO' || lpad((regexp_match(upper(btrim(codigo)), '^LT([0-9]+)$'))[1], 4, '0')
WHERE (n_loteador IS NULL OR btrim(n_loteador) = '')
  AND codigo ~* '^LT[0-9]+$';

WITH max_lo AS (
  SELECT COALESCE(MAX(NULLIF(regexp_replace(upper(btrim(n_loteador)), '^LO', ''), '')::int), -1) AS n
  FROM public.rede_loteadores
  WHERE n_loteador ~* '^LO[0-9]+$'
),
ranked AS (
  SELECT
    rl.id,
    (SELECT n FROM max_lo) + row_number() OVER (ORDER BY rl.created_at NULLS LAST, rl.id) AS seq
  FROM public.rede_loteadores rl
  WHERE rl.n_loteador IS NULL OR btrim(rl.n_loteador) = ''
)
UPDATE public.rede_loteadores rl
SET n_loteador = 'LO' || lpad(ranked.seq::text, 4, '0')
FROM ranked
WHERE rl.id = ranked.id;

WITH numbered AS (
  SELECT
    id,
    COALESCE(
      NULLIF(regexp_replace(upper(btrim(n_loteador)), '^LO', ''), '')::int,
      row_number() OVER (ORDER BY created_at NULLS LAST, id) - 1
    ) AS ord
  FROM public.rede_loteadores
)
UPDATE public.rede_loteadores rl
SET ordem = numbered.ord
FROM numbered
WHERE rl.id = numbered.id
  AND (rl.ordem IS NULL OR rl.ordem IS DISTINCT FROM numbered.ord);

CREATE INDEX IF NOT EXISTS idx_rede_loteadores_ordem ON public.rede_loteadores (ordem);
CREATE INDEX IF NOT EXISTS idx_rede_loteadores_n_loteador ON public.rede_loteadores (n_loteador);

COMMENT ON COLUMN public.rede_loteadores.n_loteador IS
  'Código sequencial do loteador (LOxxxx), análogo a rede_franqueados.n_franquia.';
COMMENT ON COLUMN public.rede_loteadores.ordem IS
  'Ordem sequencial para gerar o próximo LOxxxx.';

NOTIFY pgrst, 'reload schema';
