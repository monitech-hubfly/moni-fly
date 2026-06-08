-- 277: Rede de Franqueados — anexos da seção "Documentos do Franqueado".

ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_cnh_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_comprovante_endereco_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_estado_civil_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_irpf_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_estado_civil_justificativa TEXT;

COMMENT ON COLUMN public.rede_franqueados.anexo_cnh_path IS
  'Storage path (bucket rede-attachments) — CNH do franqueado.';
COMMENT ON COLUMN public.rede_franqueados.anexo_comprovante_endereco_path IS
  'Storage path — comprovante de endereço do franqueado.';
COMMENT ON COLUMN public.rede_franqueados.anexo_estado_civil_path IS
  'Storage path — comprovante de estado civil do franqueado.';
COMMENT ON COLUMN public.rede_franqueados.anexo_irpf_path IS
  'Storage path — declaração de IRPF do franqueado.';
COMMENT ON COLUMN public.rede_franqueados.anexo_estado_civil_justificativa IS
  'Justificativa de ausência do comprovante de estado civil (quando anexo_estado_civil_path está vazio).';
