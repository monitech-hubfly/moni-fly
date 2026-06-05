-- 249: Garante colunas de anexo (dados do negócio) em processo_step_one.
-- Idempotente para PROD onde a migration 185 pode não ter sido aplicada.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS anexo_opcao_permuta_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_contrato_permuta_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_seguro_garantia_path TEXT;

COMMENT ON COLUMN public.processo_step_one.anexo_opcao_permuta_path IS
  'Storage path (processo-docs) — opção de permuta.';
COMMENT ON COLUMN public.processo_step_one.anexo_contrato_permuta_path IS
  'Storage path (processo-docs) — contrato de permuta.';
COMMENT ON COLUMN public.processo_step_one.anexo_seguro_garantia_path IS
  'Storage path (processo-docs) — seguro garantia.';

CREATE OR REPLACE FUNCTION public.ensure_processo_step_one_anexos_negocio_columns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE public.processo_step_one
    ADD COLUMN IF NOT EXISTS anexo_opcao_permuta_path TEXT,
    ADD COLUMN IF NOT EXISTS anexo_contrato_permuta_path TEXT,
    ADD COLUMN IF NOT EXISTS anexo_seguro_garantia_path TEXT;
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_processo_step_one_anexos_negocio_columns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_processo_step_one_anexos_negocio_columns() TO service_role;
