-- Etapa 1 — Anexos (imagens) e URL do PDF de prospecção cidade
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS anexos_etapa1 JSONB,
  ADD COLUMN IF NOT EXISTS pdf_url_etapa1 TEXT;

COMMENT ON COLUMN public.processo_step_one.anexos_etapa1 IS 'Lista de anexos (url, nome) da Etapa 1 para o PDF de prospecção';
COMMENT ON COLUMN public.processo_step_one.pdf_url_etapa1 IS 'URL do PDF de prospecção cidade gerado na Etapa 1';
