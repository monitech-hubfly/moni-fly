-- Cole no Supabase → SQL Editor se justificativas de documentos falharem.
-- Depois: Settings → API → Reload schema.

ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_cof_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_contrato_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS anexo_numero_franquia_justificativa TEXT;

NOTIFY pgrst, 'reload schema';
