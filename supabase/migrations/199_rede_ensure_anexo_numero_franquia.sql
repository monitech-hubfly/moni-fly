-- Documento de número de franquia (idempotente + função para o app corrigir schema em produção)
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_numero_franquia_path TEXT;

COMMENT ON COLUMN public.rede_franqueados.anexo_numero_franquia_path IS
  'Caminho no bucket rede-attachments para o documento do número de franquia';

CREATE OR REPLACE FUNCTION public.ensure_rede_anexo_numero_franquia_column()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE public.rede_franqueados
    ADD COLUMN IF NOT EXISTS anexo_numero_franquia_path TEXT;
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_rede_anexo_numero_franquia_column() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_rede_anexo_numero_franquia_column() TO service_role;
