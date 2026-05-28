-- Cole no Supabase → SQL Editor se o upload do "Documento de número de franquia" falhar.
-- Depois: Settings → API → Reload schema (ou NOTIFY abaixo).

ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_numero_franquia_path TEXT;

COMMENT ON COLUMN public.rede_franqueados.anexo_numero_franquia_path IS
  'Caminho no bucket rede-attachments para o documento do número de franquia';

NOTIFY pgrst, 'reload schema';
