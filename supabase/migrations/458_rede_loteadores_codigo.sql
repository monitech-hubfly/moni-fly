-- 458: Código sequencial do loteador (LT0001, LT0002, ...) em rede_loteadores.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Seguro para PROD: ADD COLUMN nullable + backfill idempotente.

ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS codigo TEXT;

COMMENT ON COLUMN public.rede_loteadores.codigo IS
  'Código sequencial do loteador no padrão LT0001. Gerado automaticamente no cadastro.';

-- Backfill: numera por ordem de criação os loteadores ainda sem código,
-- continuando a partir do maior código LT já existente.
DO $$
DECLARE
  v_max INT;
BEGIN
  SELECT COALESCE(MAX((substring(codigo FROM '^LT(\d+)$'))::int), 0)
  INTO v_max
  FROM public.rede_loteadores
  WHERE codigo ~ '^LT\d+$';

  WITH ordenados AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS rn
    FROM public.rede_loteadores
    WHERE codigo IS NULL OR btrim(codigo) = ''
  )
  UPDATE public.rede_loteadores rl
  SET codigo = 'LT' || LPAD((v_max + o.rn)::text, 4, '0')
  FROM ordenados o
  WHERE rl.id = o.id;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_rede_loteadores_codigo
  ON public.rede_loteadores (codigo)
  WHERE codigo IS NOT NULL;

NOTIFY pgrst, 'reload schema';
